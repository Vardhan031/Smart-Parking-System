import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/context/AuthContext";
import { parkingService } from "@/services/parking";
import {
  Colors,
  Spacing,
  FontSize,
  BorderRadius,
  Shadows,
} from "@/constants/theme";

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const [vehicles, setVehicles] = useState<string[]>([]);
  const [newPlate, setNewPlate] = useState("");
  const [addingVehicle, setAddingVehicle] = useState(false);
  const [loading, setLoading] = useState(false);

  const fetchVehicles = useCallback(() => {
    setVehicles(user?.vehiclePlates ?? []);
  }, [user]);

  useEffect(() => {
    fetchVehicles();
  }, [fetchVehicles]);

  const handleAddVehicle = async () => {
    const trimmed = newPlate.trim().toUpperCase();
    if (!trimmed) {
      Alert.alert("Error", "Enter a plate number");
      return;
    }
    setLoading(true);
    try {
      await parkingService.linkVehicle(trimmed);
      setVehicles((prev) => [...prev, trimmed]);
      setNewPlate("");
      setAddingVehicle(false);
    } catch (err: any) {
      Alert.alert(
        "Failed",
        err.response?.data?.message || "Could not link vehicle"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveVehicle = (plate: string) => {
    Alert.alert("Remove Vehicle", `Remove ${plate}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          try {
            await parkingService.unlinkVehicle(plate);
            setVehicles((prev) => prev.filter((p) => p !== plate));
          } catch (err: any) {
            Alert.alert(
              "Failed",
              err.response?.data?.message || "Could not remove vehicle"
            );
          }
        },
      },
    ]);
  };

  const initials = (user?.name ?? "U").charAt(0).toUpperCase();

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* User card */}
      <View style={styles.userCard}>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <Text style={styles.name}>{user?.name ?? "User"}</Text>
        <Text style={styles.email}>{user?.email}</Text>
      </View>

      {/* Vehicles section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            <Ionicons name="car" size={18} color={Colors.primary} />
            <Text style={styles.sectionTitle}>Linked Vehicles</Text>
          </View>
          <Pressable
            style={({ pressed }) => [
              styles.addToggle,
              pressed && { opacity: 0.7 },
            ]}
            onPress={() => setAddingVehicle((v) => !v)}
          >
            <Ionicons
              name={addingVehicle ? "close" : "add"}
              size={20}
              color={Colors.primary}
            />
          </Pressable>
        </View>

        {addingVehicle && (
          <View style={styles.addRow}>
            <TextInput
              style={styles.plateInput}
              placeholder="e.g. KA01AB1234"
              placeholderTextColor={Colors.disabled}
              value={newPlate}
              onChangeText={setNewPlate}
              autoCapitalize="characters"
            />
            <Pressable
              style={({ pressed }) => [
                styles.addBtn,
                loading && { backgroundColor: Colors.disabled },
                pressed && !loading && { backgroundColor: Colors.primaryDark },
              ]}
              onPress={handleAddVehicle}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color={Colors.surface} />
              ) : (
                <Text style={styles.addBtnText}>Add</Text>
              )}
            </Pressable>
          </View>
        )}

        {vehicles.length === 0 ? (
          <View style={styles.emptyVehicles}>
            <Ionicons
              name="car-outline"
              size={28}
              color={Colors.textTertiary}
            />
            <Text style={styles.emptyText}>No vehicles linked yet</Text>
          </View>
        ) : (
          vehicles.map((plate, i) => (
            <View
              key={plate}
              style={[
                styles.vehicleRow,
                i === vehicles.length - 1 && { borderBottomWidth: 0 },
              ]}
            >
              <View style={styles.vehicleLeft}>
                <View style={styles.vehicleIconWrap}>
                  <Ionicons name="car" size={16} color={Colors.primary} />
                </View>
                <Text style={styles.vehiclePlate}>{plate}</Text>
              </View>
              <Pressable
                onPress={() => handleRemoveVehicle(plate)}
                hitSlop={8}
                style={({ pressed }) => [
                  styles.removeBtn,
                  pressed && { backgroundColor: Colors.dangerLight },
                ]}
              >
                <Ionicons
                  name="trash-outline"
                  size={16}
                  color={Colors.danger}
                />
              </Pressable>
            </View>
          ))
        )}
      </View>

      {/* Logout */}
      <Pressable
        style={({ pressed }) => [
          styles.logoutButton,
          pressed && { backgroundColor: Colors.dangerLight },
        ]}
        onPress={logout}
      >
        <Ionicons name="log-out-outline" size={18} color={Colors.danger} />
        <Text style={styles.logoutText}>Log Out</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: Spacing.md,
    paddingBottom: Spacing.xxl,
  },
  /* User card */
  userCard: {
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    ...Shadows.sm,
  },
  avatarCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.primary,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.md,
    ...Shadows.md,
  },
  avatarText: {
    fontSize: FontSize.xxl,
    fontWeight: "800",
    color: Colors.surface,
  },
  name: {
    fontSize: FontSize.xl,
    fontWeight: "700",
    color: Colors.text,
  },
  email: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },
  /* Section */
  section: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.md + 4,
    marginBottom: Spacing.md,
    ...Shadows.sm,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  sectionTitle: {
    fontSize: FontSize.md,
    fontWeight: "700",
    color: Colors.text,
  },
  addToggle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primaryGhost,
    justifyContent: "center",
    alignItems: "center",
  },
  addRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  plateInput: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm + 4,
    fontSize: FontSize.sm,
    color: Colors.text,
    fontWeight: "500",
  },
  addBtn: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md + 4,
    justifyContent: "center",
    alignItems: "center",
  },
  addBtnText: {
    color: Colors.surface,
    fontWeight: "700",
    fontSize: FontSize.sm,
  },
  emptyVehicles: {
    alignItems: "center",
    paddingVertical: Spacing.lg,
    gap: Spacing.sm,
  },
  emptyText: {
    color: Colors.textTertiary,
    fontSize: FontSize.sm,
  },
  vehicleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.sm + 4,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  vehicleLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm + 2,
  },
  vehicleIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: Colors.primaryGhost,
    justifyContent: "center",
    alignItems: "center",
  },
  vehiclePlate: {
    fontSize: FontSize.md,
    fontWeight: "600",
    color: Colors.text,
    letterSpacing: 1,
  },
  removeBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  /* Logout */
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    backgroundColor: Colors.surface,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    ...Shadows.sm,
  },
  logoutText: {
    color: Colors.danger,
    fontSize: FontSize.md,
    fontWeight: "700",
  },
});
