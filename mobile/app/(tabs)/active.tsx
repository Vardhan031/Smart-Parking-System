import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { parkingService } from "@/services/parking";
import {
  Colors,
  Spacing,
  FontSize,
  BorderRadius,
  Shadows,
} from "@/constants/theme";

interface ActiveSession {
  _id: string;
  plateNumber: string;
  slotNumber: number;
  entryTime: string;
  lotId:
    | string
    | {
        _id: string;
        name: string;
        pricing: { ratePerHour: number; freeMinutes: number };
      };
}

function formatDuration(ms: number) {
  const totalMin = Math.floor(ms / 60000);
  const hrs = Math.floor(totalMin / 60);
  const mins = totalMin % 60;
  if (hrs > 0) return `${hrs}h ${mins}m`;
  return `${mins}m`;
}

export default function ActiveScreen() {
  const [session, setSession] = useState<ActiveSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const fetchActive = useCallback(async () => {
    try {
      const res = await parkingService.getActiveSession();
      setSession(res.data ?? null);
    } catch {
      setSession(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchActive();
    }, [fetchActive])
  );

  // Live duration timer
  useEffect(() => {
    if (!session) return;
    const entry = new Date(session.entryTime).getTime();

    const update = () => setElapsed(Date.now() - entry);
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [session]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!session) {
    return (
      <ScrollView
        contentContainerStyle={styles.emptyContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchActive();
            }}
          />
        }
      >
        <View style={styles.emptyIcon}>
          <Ionicons name="car-outline" size={40} color={Colors.textTertiary} />
        </View>
        <Text style={styles.emptyTitle}>No Active Session</Text>
        <Text style={styles.emptySubtitle}>
          Your parking session will appear here once your vehicle is detected.
        </Text>
        <Pressable
          style={({ pressed }) => [
            styles.ctaButton,
            pressed && { backgroundColor: Colors.primaryDark },
          ]}
          onPress={() => router.push("/(tabs)")}
        >
          <Ionicons name="search" size={18} color={Colors.surface} />
          <Text style={styles.ctaText}>Find Parking</Text>
        </Pressable>
      </ScrollView>
    );
  }

  const lot = typeof session.lotId === "object" ? session.lotId : null;
  const ratePerHour = lot?.pricing?.ratePerHour ?? 0;
  const freeMinutes = lot?.pricing?.freeMinutes ?? 0;
  const elapsedMin = Math.ceil(elapsed / 60000);
  const billableMin = Math.max(0, elapsedMin - freeMinutes);
  const estimatedFare = Math.ceil((billableMin / 60) * ratePerHour);

  return (
    <ScrollView
      contentContainerStyle={styles.sessionContainer}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            fetchActive();
          }}
        />
      }
    >
      {/* Live status badge */}
      <View style={styles.liveBadge}>
        <View style={styles.liveDot} />
        <Text style={styles.liveText}>Session Active</Text>
      </View>

      {/* Timer card */}
      <View style={styles.timerCard}>
        <Text style={styles.timerText}>{formatDuration(elapsed)}</Text>
        <Text style={styles.timerLabel}>Parked Duration</Text>
      </View>

      {/* Details card */}
      <View style={styles.detailCard}>
        <DetailRow
          icon="business-outline"
          label="Lot"
          value={lot?.name ?? "—"}
        />
        <DetailRow
          icon="grid-outline"
          label="Slot"
          value={`#${session.slotNumber}`}
        />
        <DetailRow
          icon="car-sport-outline"
          label="Plate"
          value={session.plateNumber}
        />
        <DetailRow
          icon="time-outline"
          label="Entry"
          value={new Date(session.entryTime).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        />
        <View style={styles.fareRow}>
          <Text style={styles.fareLabel}>Estimated Fare</Text>
          <Text style={styles.fareValue}>₹{estimatedFare}</Text>
        </View>
      </View>
    </ScrollView>
  );
}

function DetailRow({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.rowLeft}>
        <View style={styles.rowIconWrap}>
          <Ionicons name={icon} size={16} color={Colors.primary} />
        </View>
        <Text style={styles.rowLabel}>{label}</Text>
      </View>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: Colors.background,
  },
  /* Empty state */
  emptyContainer: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.xl,
    backgroundColor: Colors.background,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.borderLight,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  emptyTitle: {
    fontSize: FontSize.xl,
    fontWeight: "700",
    color: Colors.text,
    marginTop: Spacing.xs,
  },
  emptySubtitle: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: "center",
    marginTop: Spacing.sm,
    lineHeight: 20,
    maxWidth: 280,
  },
  ctaButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.sm + 4,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.lg,
  },
  ctaText: {
    color: Colors.surface,
    fontWeight: "700",
    fontSize: FontSize.md,
  },
  /* Active session */
  sessionContainer: {
    padding: Spacing.md,
    paddingBottom: Spacing.xxl,
    backgroundColor: Colors.background,
    flexGrow: 1,
  },
  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    gap: Spacing.sm,
    backgroundColor: Colors.successLight,
    paddingVertical: Spacing.xs + 2,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
    marginBottom: Spacing.md,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.success,
  },
  liveText: {
    fontSize: FontSize.sm,
    fontWeight: "700",
    color: Colors.success,
  },
  timerCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    paddingVertical: Spacing.xl + 8,
    alignItems: "center",
    marginBottom: Spacing.md,
    ...Shadows.md,
  },
  timerText: {
    fontSize: FontSize.hero,
    fontWeight: "800",
    color: Colors.text,
    letterSpacing: -1,
  },
  timerLabel: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
    fontWeight: "500",
  },
  detailCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.md + 4,
    ...Shadows.sm,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.sm + 4,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  rowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm + 2,
  },
  rowIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: Colors.primaryGhost,
    justifyContent: "center",
    alignItems: "center",
  },
  rowLabel: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: "500",
  },
  rowValue: {
    fontSize: FontSize.sm,
    fontWeight: "600",
    color: Colors.text,
  },
  fareRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: Spacing.md,
  },
  fareLabel: {
    fontSize: FontSize.md,
    fontWeight: "600",
    color: Colors.text,
  },
  fareValue: {
    fontSize: FontSize.xl,
    fontWeight: "800",
    color: Colors.primary,
  },
});
