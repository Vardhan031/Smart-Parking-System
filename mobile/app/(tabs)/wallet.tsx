import { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  TextInput,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Modal,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { walletService } from "@/services/wallet";
import {
  Colors,
  Spacing,
  FontSize,
  BorderRadius,
  Shadows,
} from "@/constants/theme";

interface Transaction {
  _id: string;
  type: "CREDIT" | "DEBIT";
  amount: number;
  description: string;
  createdAt: string;
}

interface WalletData {
  balance: number;
  transactions: Transaction[];
}

const PRESET_AMOUNTS = [100, 200, 500, 1000];

export default function WalletScreen() {
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showTopUp, setShowTopUp] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState("");
  const [topUpLoading, setTopUpLoading] = useState(false);

  const fetchWallet = useCallback(async () => {
    try {
      const res = await walletService.getWallet();
      setWallet(res.data ?? null);
    } catch {
      // silent
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchWallet();
    }, [fetchWallet])
  );

  const handleTopUp = async () => {
    const amount = Number(topUpAmount);
    if (!amount || amount <= 0) {
      Alert.alert("Error", "Enter a valid amount");
      return;
    }
    setTopUpLoading(true);
    try {
      // Step 1: Create pending top-up order
      const orderRes = await walletService.topUp(amount);
      const orderId = orderRes.data?.orderId;

      // Step 2: Confirm payment and credit wallet
      // TODO: Integrate real payment gateway (Razorpay/Stripe) before verifying
      await walletService.verifyPayment(orderId);

      Alert.alert("Success", `₹${amount} added to wallet`);
      setShowTopUp(false);
      setTopUpAmount("");
      fetchWallet();
    } catch (err: any) {
      Alert.alert(
        "Failed",
        err.response?.data?.message || "Top-up failed"
      );
    } finally {
      setTopUpLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  const balance = wallet?.balance ?? 0;
  const transactions = wallet?.transactions ?? [];

  return (
    <View style={styles.container}>
      {/* Balance card */}
      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>Available Balance</Text>
        <Text style={styles.balanceAmount}>₹{balance.toFixed(2)}</Text>
        <Pressable
          style={({ pressed }) => [
            styles.topUpBtn,
            pressed && { opacity: 0.85 },
          ]}
          onPress={() => setShowTopUp(true)}
        >
          <Ionicons name="add" size={18} color={Colors.primary} />
          <Text style={styles.topUpBtnText}>Top Up</Text>
        </Pressable>
      </View>

      {/* Transaction list */}
      <View style={styles.sectionRow}>
        <Text style={styles.sectionTitle}>Transactions</Text>
        {transactions.length > 0 && (
          <Text style={styles.sectionCount}>{transactions.length}</Text>
        )}
      </View>

      <FlatList
        data={transactions}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchWallet();
            }}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIcon}>
              <Ionicons
                name="receipt-outline"
                size={32}
                color={Colors.textTertiary}
              />
            </View>
            <Text style={styles.emptyText}>No transactions yet</Text>
          </View>
        }
        renderItem={({ item }) => {
          const isCredit = item.type === "CREDIT";
          return (
            <View style={styles.txRow}>
              <View
                style={[
                  styles.txIconWrap,
                  {
                    backgroundColor: isCredit
                      ? Colors.successLight
                      : Colors.dangerLight,
                  },
                ]}
              >
                <Ionicons
                  name={isCredit ? "arrow-down" : "arrow-up"}
                  size={16}
                  color={isCredit ? Colors.success : Colors.danger}
                />
              </View>
              <View style={styles.txInfo}>
                <Text style={styles.txDesc} numberOfLines={1}>
                  {item.description || item.type}
                </Text>
                <Text style={styles.txDate}>
                  {new Date(item.createdAt).toLocaleDateString(undefined, {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </Text>
              </View>
              <Text
                style={[
                  styles.txAmount,
                  { color: isCredit ? Colors.success : Colors.danger },
                ]}
              >
                {isCredit ? "+" : "−"}₹{item.amount}
              </Text>
            </View>
          );
        }}
      />

      {/* Top-up modal */}
      <Modal
        visible={showTopUp}
        transparent
        animationType="slide"
        onRequestClose={() => setShowTopUp(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => {
            setShowTopUp(false);
            setTopUpAmount("");
          }}
        >
          <Pressable style={styles.modalContent} onPress={() => {}}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Top Up Wallet</Text>

            <View style={styles.presetRow}>
              {PRESET_AMOUNTS.map((amt) => (
                <Pressable
                  key={amt}
                  style={[
                    styles.presetBtn,
                    topUpAmount === String(amt) && styles.presetBtnActive,
                  ]}
                  onPress={() => setTopUpAmount(String(amt))}
                >
                  <Text
                    style={[
                      styles.presetBtnText,
                      topUpAmount === String(amt) &&
                        styles.presetBtnTextActive,
                    ]}
                  >
                    ₹{amt}
                  </Text>
                </Pressable>
              ))}
            </View>

            <TextInput
              style={styles.amountInput}
              placeholder="Or enter custom amount"
              placeholderTextColor={Colors.disabled}
              value={topUpAmount}
              onChangeText={setTopUpAmount}
              keyboardType="numeric"
            />

            <View style={styles.modalButtons}>
              <Pressable
                style={({ pressed }) => [
                  styles.cancelBtn,
                  pressed && { backgroundColor: Colors.surfaceHover },
                ]}
                onPress={() => {
                  setShowTopUp(false);
                  setTopUpAmount("");
                }}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.confirmBtn,
                  topUpLoading && { backgroundColor: Colors.disabled },
                  pressed &&
                    !topUpLoading && {
                      backgroundColor: Colors.primaryDark,
                    },
                ]}
                onPress={handleTopUp}
                disabled={topUpLoading}
              >
                <Text style={styles.confirmBtnText}>
                  {topUpLoading ? "Processing…" : "Add Money"}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: Colors.background,
  },
  /* Balance */
  balanceCard: {
    backgroundColor: Colors.primary,
    marginHorizontal: Spacing.md,
    marginTop: Spacing.md,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    alignItems: "center",
    ...Shadows.lg,
  },
  balanceLabel: {
    color: "rgba(255,255,255,0.7)",
    fontSize: FontSize.sm,
    fontWeight: "500",
  },
  balanceAmount: {
    color: Colors.surface,
    fontSize: FontSize.hero,
    fontWeight: "800",
    marginVertical: Spacing.sm,
    letterSpacing: -1,
  },
  topUpBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    backgroundColor: Colors.surface,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.full,
    marginTop: Spacing.xs,
  },
  topUpBtnText: {
    color: Colors.primary,
    fontWeight: "700",
    fontSize: FontSize.sm,
  },
  /* Section header */
  sectionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.md,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  sectionTitle: {
    fontSize: FontSize.md,
    fontWeight: "700",
    color: Colors.text,
  },
  sectionCount: {
    fontSize: FontSize.sm,
    color: Colors.textTertiary,
    fontWeight: "500",
  },
  listContent: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.xxl },
  /* Empty */
  emptyContainer: {
    alignItems: "center",
    paddingTop: Spacing.xxl,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.borderLight,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  emptyText: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
  },
  /* Transactions */
  txRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.sm,
    gap: Spacing.sm + 2,
    ...Shadows.sm,
  },
  txIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  txInfo: { flex: 1 },
  txDesc: {
    fontSize: FontSize.sm,
    color: Colors.text,
    fontWeight: "600",
  },
  txDate: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  txAmount: {
    fontSize: FontSize.md,
    fontWeight: "800",
  },
  /* Modal */
  modalOverlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.xl,
    paddingBottom: Spacing.xxl,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: "center",
    marginBottom: Spacing.lg,
  },
  modalTitle: {
    fontSize: FontSize.xl,
    fontWeight: "800",
    color: Colors.text,
    marginBottom: Spacing.lg,
    textAlign: "center",
  },
  presetRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  presetBtn: {
    flex: 1,
    paddingVertical: Spacing.sm + 4,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: "center",
  },
  presetBtnActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryGhost,
  },
  presetBtnText: {
    fontSize: FontSize.sm,
    color: Colors.text,
    fontWeight: "600",
  },
  presetBtnTextActive: {
    color: Colors.primary,
    fontWeight: "700",
  },
  amountInput: {
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: FontSize.lg,
    textAlign: "center",
    color: Colors.text,
    fontWeight: "600",
    marginBottom: Spacing.lg,
  },
  modalButtons: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: Spacing.sm + 6,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: "center",
  },
  cancelBtnText: {
    color: Colors.textSecondary,
    fontWeight: "700",
  },
  confirmBtn: {
    flex: 2,
    paddingVertical: Spacing.sm + 6,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.primary,
    alignItems: "center",
  },
  confirmBtnText: {
    color: Colors.surface,
    fontWeight: "700",
    fontSize: FontSize.md,
  },
});
