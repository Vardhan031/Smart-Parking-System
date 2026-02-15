import { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { parkingService } from "@/services/parking";
import {
  Colors,
  Spacing,
  FontSize,
  BorderRadius,
  Shadows,
} from "@/constants/theme";

interface Session {
  _id: string;
  plateNumber: string;
  slotNumber: number;
  entryTime: string;
  exitTime: string;
  durationMinutes: number;
  fare: number | null;
  paymentStatus: "PAID" | "UNPAID" | "NO_USER" | null;
  lotId: string | { _id: string; name: string };
}

const PAGE_SIZE = 15;

const PAYMENT_BADGE: Record<
  string,
  { bg: string; text: string; label: string }
> = {
  PAID: { bg: Colors.successLight, text: Colors.success, label: "Paid" },
  UNPAID: { bg: Colors.dangerLight, text: Colors.danger, label: "Unpaid" },
  NO_USER: { bg: Colors.borderLight, text: Colors.secondary, label: "Guest" },
};

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDurationMins(mins: number) {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export default function HistoryScreen() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchPage = useCallback(
    async (pageNum: number, replace = false) => {
      try {
        const res = await parkingService.getSessionHistory({
          page: pageNum,
          limit: PAGE_SIZE,
        });
        const data: Session[] = res.data ?? [];
        if (replace) {
          setSessions(data);
        } else {
          setSessions((prev) => [...prev, ...data]);
        }
        setHasMore(data.length >= PAGE_SIZE);
        setPage(pageNum);
      } catch {
        // silent
      } finally {
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
      }
    },
    []
  );

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchPage(1, true);
    }, [fetchPage])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchPage(1, true);
  };

  const onEndReached = () => {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    fetchPage(page + 1);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <FlatList
      style={styles.screen}
      data={sessions}
      keyExtractor={(item) => item._id}
      contentContainerStyle={styles.list}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
      onEndReached={onEndReached}
      onEndReachedThreshold={0.3}
      ListEmptyComponent={
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIcon}>
            <Ionicons
              name="time-outline"
              size={40}
              color={Colors.textTertiary}
            />
          </View>
          <Text style={styles.emptyTitle}>No parking history yet</Text>
          <Text style={styles.emptySubtitle}>
            Completed sessions will appear here
          </Text>
        </View>
      }
      ListFooterComponent={
        loadingMore ? (
          <ActivityIndicator
            style={{ padding: Spacing.md }}
            color={Colors.primary}
          />
        ) : null
      }
      renderItem={({ item }) => {
        const lotName =
          typeof item.lotId === "object" ? item.lotId.name : "—";
        const badge = item.paymentStatus
          ? PAYMENT_BADGE[item.paymentStatus]
          : null;

        return (
          <View style={styles.card}>
            <View style={styles.cardTop}>
              <Text style={styles.lotName} numberOfLines={1}>
                {lotName}
              </Text>
              {badge ? (
                <View
                  style={[styles.badge, { backgroundColor: badge.bg }]}
                >
                  <Text style={[styles.badgeText, { color: badge.text }]}>
                    {badge.label}
                  </Text>
                </View>
              ) : null}
            </View>

            <View style={styles.metaRow}>
              <View style={styles.metaItem}>
                <Ionicons
                  name="car-sport-outline"
                  size={14}
                  color={Colors.textTertiary}
                />
                <Text style={styles.metaText}>{item.plateNumber}</Text>
              </View>
              <View style={styles.metaItem}>
                <Ionicons
                  name="grid-outline"
                  size={14}
                  color={Colors.textTertiary}
                />
                <Text style={styles.metaText}>Slot #{item.slotNumber}</Text>
              </View>
            </View>

            <View style={styles.timeRow}>
              <Ionicons
                name="time-outline"
                size={14}
                color={Colors.textTertiary}
              />
              <Text style={styles.timeText}>
                {formatDateTime(item.entryTime)} →{" "}
                {formatDateTime(item.exitTime)}
              </Text>
            </View>

            <View style={styles.cardBottom}>
              <View style={styles.durationTag}>
                <Ionicons
                  name="hourglass-outline"
                  size={12}
                  color={Colors.secondary}
                />
                <Text style={styles.durationText}>
                  {formatDurationMins(item.durationMinutes)}
                </Text>
              </View>
              <Text style={styles.fare}>
                {item.fare != null ? `₹${item.fare}` : "—"}
              </Text>
            </View>
          </View>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: Colors.background,
  },
  list: {
    padding: Spacing.md,
    paddingBottom: Spacing.xxl,
    flexGrow: 1,
  },
  /* Empty */
  emptyContainer: {
    alignItems: "center",
    paddingTop: Spacing.xxl * 2,
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
    fontSize: FontSize.md,
    fontWeight: "600",
    color: Colors.text,
  },
  emptySubtitle: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },
  /* Card */
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm + 2,
    ...Shadows.sm,
  },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  lotName: {
    fontSize: FontSize.md,
    fontWeight: "600",
    color: Colors.text,
    flex: 1,
  },
  badge: {
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  badgeText: {
    fontSize: FontSize.xs,
    fontWeight: "700",
  },
  metaRow: {
    flexDirection: "row",
    gap: Spacing.md,
    marginBottom: Spacing.xs + 2,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  metaText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: "500",
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  timeText: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
  },
  cardBottom: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  durationTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    backgroundColor: Colors.borderLight,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  durationText: {
    fontSize: FontSize.xs,
    color: Colors.secondary,
    fontWeight: "600",
  },
  fare: {
    fontSize: FontSize.lg,
    fontWeight: "800",
    color: Colors.text,
  },
});
