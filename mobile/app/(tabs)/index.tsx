import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  TextInput,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import ParkingMap from "@/components/ParkingMap";
import { parkingService } from "@/services/parking";
import { useLocation } from "@/hooks/useLocation";
import {
  Colors,
  Spacing,
  FontSize,
  BorderRadius,
  Shadows,
} from "@/constants/theme";

interface Lot {
  _id: string;
  name: string;
  code: string;
  location: { address: string; latitude: number; longitude: number };
  totalSlots: number;
  pricing: { ratePerHour: number; freeMinutes: number };
  availableSlots?: number;
}

export default function HomeScreen() {
  const { location } = useLocation();
  const [lots, setLots] = useState<Lot[]>([]);
  const [filtered, setFiltered] = useState<Lot[]>([]);
  const [search, setSearch] = useState("");
  const [showMap, setShowMap] = useState(true);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchLots = useCallback(async () => {
    try {
      const params = location
        ? { lat: location.latitude, lng: location.longitude }
        : undefined;
      const res = await parkingService.listLots(params);
      const data = res.data ?? [];
      setLots(data);
      setFiltered(data);
    } catch {
      // silent
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [location]);

  useEffect(() => {
    fetchLots();
  }, [fetchLots]);

  useEffect(() => {
    if (!search.trim()) {
      setFiltered(lots);
      return;
    }
    const q = search.toLowerCase();
    setFiltered(
      lots.filter(
        (l) =>
          l.name.toLowerCase().includes(q) ||
          l.location?.address?.toLowerCase().includes(q)
      )
    );
  }, [search, lots]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchLots();
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Search + toggle */}
      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color={Colors.textTertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search parking lots…"
            placeholderTextColor={Colors.disabled}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch("")} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={Colors.disabled} />
            </Pressable>
          )}
        </View>
        <Pressable
          style={({ pressed }) => [
            styles.toggleBtn,
            pressed && { backgroundColor: Colors.surfaceHover },
          ]}
          onPress={() => setShowMap((v) => !v)}
        >
          <Ionicons
            name={showMap ? "list" : "map"}
            size={20}
            color={Colors.primary}
          />
        </Pressable>
      </View>

      {showMap && location ? (
        <ParkingMap
          latitude={location.latitude}
          longitude={location.longitude}
          lots={filtered}
          onLotPress={(id) => router.push(`/lot/${id}`)}
        />
      ) : null}

      {/* Lot list */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="search-outline" size={48} color={Colors.disabled} />
            <Text style={styles.emptyTitle}>No parking lots found</Text>
            <Text style={styles.emptySubtitle}>
              {search ? "Try a different search term" : "Pull down to refresh"}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [
              styles.card,
              pressed && { backgroundColor: Colors.surfaceHover },
            ]}
            onPress={() => router.push(`/lot/${item._id}`)}
          >
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle} numberOfLines={1}>
                {item.name}
              </Text>
              <View
                style={[
                  styles.cardBadge,
                  (item.availableSlots ?? 0) === 0 && styles.cardBadgeFull,
                ]}
              >
                <View
                  style={[
                    styles.badgeDot,
                    {
                      backgroundColor:
                        (item.availableSlots ?? 0) > 0
                          ? Colors.success
                          : Colors.danger,
                    },
                  ]}
                />
                <Text
                  style={[
                    styles.cardBadgeText,
                    (item.availableSlots ?? 0) === 0 &&
                      styles.cardBadgeTextFull,
                  ]}
                >
                  {(item.availableSlots ?? 0) > 0
                    ? `${item.availableSlots} free`
                    : "Full"}
                </Text>
              </View>
            </View>
            {item.location?.address ? (
              <View style={styles.addressRow}>
                <Ionicons
                  name="location-outline"
                  size={14}
                  color={Colors.textTertiary}
                />
                <Text style={styles.cardAddress} numberOfLines={1}>
                  {item.location.address}
                </Text>
              </View>
            ) : null}
            <View style={styles.cardFooter}>
              <Text style={styles.cardPricing}>
                ₹{item.pricing.ratePerHour}/hr
              </Text>
              {item.pricing.freeMinutes > 0 && (
                <View style={styles.freeTag}>
                  <Text style={styles.freeTagText}>
                    {item.pricing.freeMinutes} min free
                  </Text>
                </View>
              )}
            </View>
          </Pressable>
        )}
      />
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
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    gap: Spacing.sm,
  },
  searchBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.sm + 4,
    height: 44,
    gap: Spacing.sm,
    ...Shadows.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: FontSize.sm,
    color: Colors.text,
  },
  toggleBtn: {
    width: 44,
    height: 44,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    ...Shadows.sm,
  },
  listContent: {
    padding: Spacing.md,
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.xxl,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm + 2,
    ...Shadows.sm,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.xs + 2,
    gap: Spacing.sm,
  },
  cardTitle: {
    fontSize: FontSize.md,
    fontWeight: "600",
    color: Colors.text,
    flex: 1,
  },
  cardBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    backgroundColor: Colors.successLight,
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  cardBadgeFull: {
    backgroundColor: Colors.dangerLight,
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  cardBadgeText: {
    fontSize: FontSize.xs,
    fontWeight: "600",
    color: Colors.success,
  },
  cardBadgeTextFull: {
    color: Colors.danger,
  },
  addressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  cardAddress: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    flex: 1,
  },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  cardPricing: {
    fontSize: FontSize.sm,
    color: Colors.text,
    fontWeight: "700",
  },
  freeTag: {
    backgroundColor: Colors.primaryGhost,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  freeTagText: {
    fontSize: FontSize.xs,
    color: Colors.primary,
    fontWeight: "600",
  },
  emptyContainer: {
    alignItems: "center",
    paddingTop: Spacing.xxl,
  },
  emptyTitle: {
    fontSize: FontSize.md,
    fontWeight: "600",
    color: Colors.text,
    marginTop: Spacing.md,
  },
  emptySubtitle: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },
});
