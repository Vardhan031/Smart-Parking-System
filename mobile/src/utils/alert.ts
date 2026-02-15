import { Alert, Platform } from "react-native";

type AlertButton = {
  text?: string;
  onPress?: () => void;
};

/**
 * Cross-platform alert that works on both native and web.
 * On web, falls back to window.alert / window.confirm.
 */
export function showAlert(
  title: string,
  message?: string,
  buttons?: AlertButton[]
) {
  if (Platform.OS === "web") {
    const msg = message ? `${title}\n\n${message}` : title;
    if (buttons && buttons.length > 1) {
      const confirmed = window.confirm(msg);
      if (confirmed) {
        buttons[1]?.onPress?.();
      } else {
        buttons[0]?.onPress?.();
      }
    } else {
      window.alert(msg);
      buttons?.[0]?.onPress?.();
    }
  } else {
    Alert.alert(title, message, buttons);
  }
}
