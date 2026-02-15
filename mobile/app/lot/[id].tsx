import { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Pressable,
  Linking,
  Platform,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { parkingService } from "@/services/parking";
import {
  Colors,
  Spacing,
  FontSize,
  BorderRadius,
  Shadows,
} from "@/constants/theme";

interface SlotBreakdown {
  vehicleType: string;
  available: number;
  occupied: number;
  maintenance: number;
  total: number;
}

interface LotDetail {
  _id: string;
  name: string;
  code: string;
  location: { address: string; latitude: number; longitude: number };
  totalSlots: number;
  pricing: { ratePerHour: number; freeMinutes: number };
  active: boolean;
  slots?: SlotBreakdown[];
  availableSlots?: number;
}

export default function LotDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [lot, setLot] = useState<LotDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await parkingService.getLotDetail(id);
        setLot(res.data ?? null);
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const handleNavigate = () => {
    if (!lot?.location?.latitude || !lot?.location?.longitude) return;
    const { latitude, longitude } = lot.location;
    const label = encodeURIComponent(lot.name);

    const url = Platform.select({
      ios: `maps:0,0?q=${label}@${latitude},${longitude}`,
      android: `geo:${latitude},${longitude}?q=${latitude},${longitude}(${label})`,
    });

    if (url) {
      Linking.openURL(url).catch(() => {
        Linking.openURL(
          `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`
        );
      });
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!lot) {
    return (
      <View style={styles.center}>
        <Ionicons
          name="alert-circle-outline"
          size={48}
          color={Colors.disabled}
        />
        <Text style={styles.errorText}>Lot not found</Text>
      </View>
    );
  }

  const slots: SlotBreakdown[] = lot.slots ?? [];
  const totalAvailable =
    lot.availableSlots ?? slots.reduce((s, b) => s + b.available, 0);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.headerCard}>
        <View style={styles.headerTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{lot.name}</Text>
            <Text style={styles.code}>{lot.code}</Text>
          </View>
          <View
            style={[
              styles.statusBadge,
              {
                backgroundColor: lot.active
                  ? Colors.successLight
                  : Colors.dangerLight,
              },
            ]}
          >
            <View
              style={[
                styles.statusDot,
                {
                  backgroundColor: lot.active
                    ? Colors.success
                    : Colors.danger,
                },
              ]}
            />
            <Text
              style={[
                styles.statusText,
                { color: lot.active ? Colors.success : Colors.danger },
              ]}
            >
              {lot.active ? "Open" : "Closed"}
            </Text>
          </View>
        </View>
        {lot.location?.address ? (
          <View style={styles.addressRow}>
            <Ionicons
              name="location"
              size={14}
              color={Colors.textTertiary}
            />
            <Text style={styles.address}>{lot.location.address}</Text>
          </View>
        ) : null}
      </View>

      {/* Stats row */}
      <View style={styles.statsRow}>
        <StatBox
          label="Rate"
          value={`₹${lot.pricing.ratePerHour}`}
          sublabel="per hour"
          icon="pricetag"
        />
        <StatBox
          label="Free"
          value={`${lot.pricing.freeMinutes}`}
          sublabel="minutes"
          icon="time"
        />
        <StatBox
          label="Available"
          value={`${totalAvailable}`}
          sublabel={`of ${lot.totalSlots}`}
          icon="grid"
          highlight
        />
      </View>

      {/* Slot availability breakdown */}
      {slots.length > 0 && (
        <View style={styles.slotsCard}>
          <Text style={styles.cardTitle}>Slot Breakdown</Text>
          {slots.map((s, i) => (
            <View
              key={s.vehicleType}
              style={[
                styles.slotRow,
                i === slots.length - 1 && { borderBottomWidth: 0 },
              ]}
            >
              <View style={styles.slotType}>
                <Ionicons
                  name={
                    s.vehicleType === "MOTORCYCLE"
                      ? "bicycle"
                      : s.vehicleType === "TRUCK"
                        ? "bus"
                        : "car"
                  }
                  size={18}
                  color={Colors.primary}
                />
                <Text style={styles.slotTypeText}>{s.vehicleType}</Text>
              </View>
              <View style={styles.slotCounts}>
                <SlotBadge
                  count={s.available}
                  label="Free"
                  color={Colors.success}
                  bg={Colors.successLight}
                />
                <SlotBadge
                  count={s.occupied}
                  label="Used"
                  color={Colors.warning}
                  bg={Colors.warningLight}
                />
                <SlotBadge
                  count={s.maintenance}
                  label="Maint."
                  color={Colors.secondary}
                  bg={Colors.borderLight}
                />
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Navigate button */}
      {lot.location?.latitude && lot.location?.longitude ? (
        <Pressable
          style={({ pressed }) => [
            styles.navButton,
            pressed && { backgroundColor: Colors.primaryDark },
          ]}
          onPress={handleNavigate}
        >
          <Ionicons name="navigate" size={18} color={Colors.surface} />
          <Text style={styles.navButtonText}>Navigate to Lot</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

function StatBox({
  label,
  value,
  sublabel,
  icon,
  highlight,
}: {
  label: string;
  value: string;
  sublabel: string;
  icon: keyof typeof Ionicons.glyphMap;
  highlight?: boolean;
}) {
  return (
    <View style={[styles.statBox, highlight && styles.statBoxHighlight]}>
      <Ionicons
        name={icon}
        size={16}
        color={highlight ? Colors.primary : Colors.textTertiary}
      />
      <Text
        style={[styles.statValue, highlight && { color: Colors.primary }]}
      >
        {value}
      </Text>
      <Text style={styles.statSublabel}>{sublabel}</Text>
    </View>
  );
}

function SlotBadge({
  count,
  label,
  color,
  bg,
}: {
  count: number;
  label: string;
  color: string;
  bg: string;
}) {
  return (
    <View style={[styles.slotBadge, { backgroundColor: bg }]}>
      <Text style={[styles.slotBadgeCount, { color }]}>{count}</Text>
      <Text style={styles.slotBadgeLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.md, paddingBottom: Spacing.xxl },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: Colors.background,
    gap: Spacing.sm,
  },
  errorText: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    fontWeight: "500",
  },
  /* Header */
  headerCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.md + 4,
    marginBottom: Spacing.md,
    ...Shadows.sm,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: Spacing.sm,
  },
  name: {
    fontSize: FontSize.xl,
    fontWeight: "800",
    color: Colors.text,
    letterSpacing: -0.3,
  },
  code: {
    fontSize: FontSize.sm,
    color: Colors.textTertiary,
    fontWeight: "600",
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: Spacing.xs + 1,
    borderRadius: BorderRadius.full,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: FontSize.xs,
    fontWeight: "700",
  },
  addressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  address: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    flex: 1,
  },
  /* Stats */
  statsRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  statBox: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md,
    alignItems: "center",
    gap: Spacing.xs,
    ...Shadows.sm,
  },
  statBoxHighlight: {
    backgroundColor: Colors.primaryGhost,
  },
  statValue: {
    fontSize: FontSize.xl,
    fontWeight: "800",
    color: Colors.text,
  },
  statSublabel: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    fontWeight: "500",
  },
  /* Slots */
  slotsCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.md + 4,
    marginBottom: Spacing.md,
    ...Shadows.sm,
  },
  cardTitle: {
    fontSize: FontSize.md,
    fontWeight: "700",
    color: Colors.text,
    marginBottom: Spacing.sm + 2,
  },
  slotRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  slotType: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  slotTypeText: {
    fontSize: FontSize.sm,
    fontWeight: "600",
    color: Colors.text,
  },
  slotCounts: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  slotBadge: {
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
    minWidth: 44,
  },
  slotBadgeCount: {
    fontSize: FontSize.sm,
    fontWeight: "800",
  },
  slotBadgeLabel: {
    fontSize: 10,
    color: Colors.textTertiary,
    fontWeight: "500",
    marginTop: 1,
  },
  /* Navigate */
  navButton: {
    flexDirection: "row",
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    ...Shadows.md,
  },
  navButtonText: {
    color: Colors.surface,
    fontSize: FontSize.md,
    fontWeight: "700",
  },
});
