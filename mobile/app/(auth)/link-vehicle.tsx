import { useState } from "react";
import {
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  View,
  ScrollView,
} from "react-native";
import { showAlert } from "@/utils/alert";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { parkingService } from "@/services/parking";
import {
  Colors,
  Spacing,
  FontSize,
  BorderRadius,
  Shadows,
} from "@/constants/theme";

export default function LinkVehicleScreen() {
  const [plate, setPlate] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLink = async () => {
    const trimmed = plate.trim().toUpperCase();
    if (!trimmed) {
      showAlert("Error", "Please enter a vehicle plate number");
      return;
    }
    setLoading(true);
    try {
      await parkingService.linkVehicle(trimmed);
      showAlert("Success", `Vehicle ${trimmed} linked!`, [
        { text: "Continue", onPress: () => router.replace("/(tabs)") },
      ]);
    } catch (err: any) {
      showAlert(
        "Failed",
        err.response?.data?.message || "Could not link vehicle"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    router.replace("/(tabs)");
  };

  return (
    <KeyboardAvoidingView
      style={styles.wrapper}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.iconCircle}>
          <Ionicons name="car" size={36} color={Colors.primary} />
        </View>

        <Text style={styles.title}>Link Your Vehicle</Text>
        <Text style={styles.subtitle}>
          Add your vehicle plate so we can track your parking sessions
          automatically.
        </Text>

        <View style={styles.formCard}>
          <Text style={styles.label}>Vehicle Plate Number</Text>
          <TextInput
            style={styles.plateInput}
            placeholder="e.g. KA01AB1234"
            placeholderTextColor={Colors.disabled}
            value={plate}
            onChangeText={setPlate}
            autoCapitalize="characters"
          />

          <Pressable
            style={({ pressed }) => [
              styles.button,
              loading && styles.buttonDisabled,
              pressed && !loading && styles.buttonPressed,
            ]}
            onPress={handleLink}
            disabled={loading}
          >
            <Ionicons
              name="link-outline"
              size={18}
              color={Colors.surface}
              style={{ marginRight: Spacing.xs }}
            />
            <Text style={styles.buttonText}>
              {loading ? "Linking…" : "Link Vehicle"}
            </Text>
          </Pressable>
        </View>

        <Pressable style={styles.skipBtn} onPress={handleSkip}>
          <Text style={styles.skipText}>Skip for now</Text>
          <Ionicons
            name="arrow-forward"
            size={16}
            color={Colors.textSecondary}
          />
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  container: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.lg,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.primaryGhost,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  title: {
    fontSize: FontSize.xxl,
    fontWeight: "800",
    color: Colors.text,
    textAlign: "center",
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    textAlign: "center",
    marginTop: Spacing.sm,
    marginBottom: Spacing.xl,
    lineHeight: 22,
    paddingHorizontal: Spacing.md,
  },
  formCard: {
    width: "100%",
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    ...Shadows.md,
  },
  label: {
    fontSize: FontSize.sm,
    fontWeight: "600",
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  plateInput: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    fontSize: FontSize.lg,
    textAlign: "center",
    letterSpacing: 2,
    color: Colors.text,
    fontWeight: "600",
    marginBottom: Spacing.md,
  },
  button: {
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.sm + 6,
    borderRadius: BorderRadius.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  buttonDisabled: {
    backgroundColor: Colors.disabled,
  },
  buttonPressed: {
    backgroundColor: Colors.primaryDark,
  },
  buttonText: {
    color: Colors.surface,
    fontSize: FontSize.md,
    fontWeight: "700",
  },
  skipBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginTop: Spacing.xl,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  skipText: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    fontWeight: "500",
  },
});
