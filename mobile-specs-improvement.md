# Mobile App – Aesthetic & Standards Improvement Spec

## Overview

This document covers every screen and system in the Expo/React Native mobile app, cataloguing specific improvements needed to bring the app to current industry standards. Changes are grouped by theme: visual design, UX/interaction, per-screen issues, architecture, and accessibility.

---

## 1. Design System & Visual Identity

### 1.1 Custom Typography
**Current state:** All text renders in the system font (San Francisco on iOS, Roboto on Android). No font family is declared in `theme.ts`.

**Improvement:**
- Add a custom font family. Recommended: **Inter** (clean, modern, readable — used by Linear, Vercel, Notion). Load it via `expo-font` or `@expo-google-fonts/inter`.
- Define a `FontFamily` constant in `theme.ts`:
  ```ts
  export const FontFamily = {
    regular: "Inter_400Regular",
    medium:  "Inter_500Medium",
    semiBold: "Inter_600SemiBold",
    bold:    "Inter_700Bold",
    extraBold: "Inter_800ExtraBold",
  };
  ```
- Replace all hardcoded `fontWeight` values in `StyleSheet` with the correct named variant, and apply `fontFamily` to every `Text` style.
- Wrap the app in a `useFonts` guard in `app/_layout.tsx` so no text flashes before fonts are ready.

### 1.2 Gradient Support
**Current state:** The wallet balance card and auth brand section use flat solid colours. Gradients are not used anywhere.

**Improvement:**
- Install `expo-linear-gradient`.
- Apply gradient to:
  - **Wallet balance card** — `#2563EB` → `#7C3AED` (blue-to-violet, feels financial/premium).
  - **Login brand section background** — subtle top-fade from `#EFF6FF` to transparent.
  - **Active session timer card** — subtle light gradient so it feels "live".
- Keep all other surfaces flat white — gradients should be used sparingly as accent, not decoration.

### 1.3 Dark Mode
**Current state:** `app.json` sets `userInterfaceStyle: "automatic"` but `theme.ts` has no dark colour variants. The app will look broken in system dark mode.

**Improvement:**
- Add a `DarkColors` palette to `theme.ts` mirroring all keys of `Colors`:
  ```ts
  export const DarkColors = {
    primary:        "#3B82F6",
    primaryGhost:   "#1E3A5F",
    background:     "#0F172A",
    surface:        "#1E293B",
    surfaceHover:   "#334155",
    text:           "#F8FAFC",
    textSecondary:  "#94A3B8",
    textTertiary:   "#64748B",
    border:         "#334155",
    borderLight:    "#1E293B",
    overlay:        "rgba(0, 0, 0, 0.6)",
    // ... all others
  };
  ```
- Create a `useTheme()` hook in `context/ThemeContext.tsx` that reads `useColorScheme()` from React Native and returns the correct colour set.
- Replace all direct imports of `Colors` across screens with `const { Colors } = useTheme()`.

### 1.4 Spacing & Sizing System Gaps
**Current state:** `Spacing` jumps from `sm: 8` to `md: 16` with no 12 stop. Several files use magic arithmetic (`Spacing.sm + 4`, `Spacing.sm + 6`, `Spacing.xs + 2`) to work around this.

**Improvement:**
- Add a `Spacing.smPlus = 12` and `Spacing.mdPlus = 20` to eliminate all inline arithmetic on spacing values.
- This makes styles self-documenting and consistent.

### 1.5 Shadow Tokens
**Current state:** Three shadow levels (sm, md, lg) are defined but the difference between `sm` and `md` on iOS is very subtle (`opacity: 0.06` vs `0.08`). On Android the elevation jumps from 2 → 4 → 8.

**Improvement:**
- Increase shadow visibility slightly for `md` and `lg`:
  - `md`: `shadowOpacity: 0.10, shadowRadius: 10, elevation: 5`
  - `lg`: `shadowOpacity: 0.16, shadowRadius: 20, elevation: 12`
- This makes card layering more perceptible, which is important on OLED screens.

---

## 2. Navigation & Tab Bar

### 2.1 Tab Bar Visual Upgrade
**Current state:** The tab bar is a plain white bar with basic icon/label. `paddingBottom` is hardcoded differently for iOS/Android. No animated indicator on the active tab.

**Improvement:**
- Use `react-native-tab-view` or Expo Router's native tab bar with a custom `tabBar` renderer to add:
  - **Pill/bubble indicator** behind the active icon (as seen in Uber Eats, Google Maps mobile).
  - Active icon scales up slightly (e.g., `scale: 1.1`) using `Reanimated`.
  - Use `useSafeAreaInsets()` from `react-native-safe-area-context` for proper bottom padding instead of the current `Platform.OS === "ios" ? 0 : 6` hack.
- Tab labels for inactive tabs could be hidden for a minimal iOS-style look.

### 2.2 Lot Detail Header
**Current state:** The lot detail screen is opened via `router.push("/lot/${id}")` and the root layout gives it a static title `"Lot Details"`. The actual lot name is never shown in the header until the content loads.

**Improvement:**
- Use `expo-router`'s `<Stack.Screen>` inside `lot/[id].tsx` to dynamically set the header title once `lot` data is fetched:
  ```tsx
  <Stack.Screen options={{ title: lot?.name ?? "Lot Details" }} />
  ```
- Style the back button to match the brand colour (`tintColor: Colors.primary`).

### 2.3 Status Bar Handling
**Current state:** `<StatusBar style="auto" />` is used, which works but doesn't differentiate the wallet screen (which has a coloured card at the top) from the white screens.

**Improvement:**
- Use `useFocusEffect` + `StatusBar.setBarStyle` per-screen for screens that need light content on a dark header (e.g., wallet's primary-coloured balance card, active session).

---

## 3. Auth Screens

### 3.1 Login Screen (`(auth)/login.tsx`)
**Issues:**
- No "Forgot Password?" link — standard on every production login form.
- No inline validation feedback — errors only appear via `Alert.alert` which is jarring.
- Input active/focus state is not visually differentiated (border colour stays the same when focused).
- Pressing outside the form does not dismiss the keyboard.

**Improvements:**
- Add a "Forgot Password?" `Pressable` below the password field, styled in `Colors.primary`.
- Add per-field error states: track `{ email: string; password: string }` error state and show a small red error message under the offending field instead of (or alongside) the alert.
- Add `onFocus`/`onBlur` handlers to `TextInput` to toggle `borderColor` between `Colors.border` and `Colors.primary`.
- Wrap the `ScrollView` in a `Pressable` with `onPress={() => Keyboard.dismiss()}`.
- Animate the form card in with a subtle `FadeInDown` using `Reanimated` entering animation.

### 3.2 Register Screen (`(auth)/register.tsx`)
**Issues:**
- No brand icon/logo at the top (Login has one, Register doesn't — inconsistent).
- Password and Confirm Password fields have no show/hide toggle.
- The `InputField` component doesn't support `showPassword` toggle, so it can't be added without restructuring.
- Phone number field accepts any input — no formatting hint for Indian numbers.

**Improvements:**
- Add the same `iconCircle` + `title` brand section as Login at the top.
- Extend the `InputField` component to accept an optional `isPassword?: boolean` prop that renders an eye toggle.
- Add `(+91)` prefix hint to the phone placeholder or use a country-code prefix view.
- Show a password strength indicator (a simple coloured bar: weak/medium/strong) below the password field.

### 3.3 Link Vehicle Screen (`(auth)/link-vehicle.tsx`)
**Issues:**
- This is an onboarding step but it looks like a plain form. Industry-standard onboarding uses progress indicators or illustrated steps.
- The plate input has `letterSpacing: 2` which is good, but the field isn't styled like a physical number plate (which would be highly distinctive).
- No format hint (e.g., `"XX00XX0000"` format guide).

**Improvements:**
- Add a step indicator (e.g., "Step 2 of 2" with a progress bar) at the top to contextualise this as part of onboarding.
- Style the plate input like an Indian number plate — yellow background, black border, monospace font.
- Add a subtle regex-based format hint that appears as the user types (e.g., shows green check when format matches `[A-Z]{2}[0-9]{2}[A-Z]{1,2}[0-9]{4}`).
- Use a `Lottie` animation (car driving into a parking spot) as the screen illustration instead of a static icon.

---

## 4. Home Screen (`(tabs)/index.tsx`)

### 4.1 Loading State — No Skeleton
**Current state:** Shows a centred `ActivityIndicator`. This is jarring — the screen is blank, then content appears all at once.

**Improvement:**
- Implement skeleton loading cards using `Animated` (pulse effect with alternating opacity between 0.4 and 0.9). Show 4–5 skeleton cards while `loading === true`.

### 4.2 Map Integration
**Current state:** `ParkingMap` uses a fixed `height: 220` in its `StyleSheet`. The map is hidden if `location` is unavailable. There is no fallback state shown when location is denied.

**Improvements:**
- Make map height **dynamic** — either use `Dimensions.get("window").height * 0.28` or make it collapsible with a drag handle (show list below map, swipe up to see more list items).
- Custom map markers: replace default red pin markers with custom `MapCallout` components that show the lot name, available slots, and price in a styled bubble.
- When `location` is null due to permission denial, show a banner: "Enable location to see nearby lots" with a Settings deeplink button.
- Add user location blue dot (already enabled via `showsUserLocation` — good).
- Consider adding `react-native-maps` cluster support (`react-native-map-clustering`) when many lots are close together.

### 4.3 Lot Card Design
**Current state:** Cards are basic — name, address, price, free-minutes tag, availability badge.

**Improvements:**
- Add a **distance indicator** (e.g., "1.2 km away") if user location is available. This requires computing haversine distance client-side.
- Add a **visual capacity bar** — a thin coloured bar below the card showing `occupiedSlots / totalSlots` ratio (green → yellow → red).
- Parking lot cards could have a small colour-coded left border (green if available, red if full) for instant scannability.
- Add a subtle `useNativeDriver`-powered press animation: the card should scale down to `0.98` on press (using `Animated.spring`).

### 4.4 Search & Filter
**Current state:** Only text search is available. No sort, no filter.

**Improvements:**
- Add a **filter row** below the search bar with quick filter chips: `All`, `Available`, `< ₹50/hr`, `< 1 km`. These can be `Pressable` pill buttons.
- Add sort: a small sort icon that opens a bottom sheet with options (Nearest, Price: Low to High, Most Available).

---

## 5. Active Session Screen (`(tabs)/active.tsx`)

### 5.1 Live Badge — No Animation
**Current state:** The green dot in the "Session Active" badge is static. There is no pulse.

**Improvement:**
- Animate the `liveDot` with a repeating `Animated.sequence` that scales from `1.0` → `1.5` → `1.0` every 1.5s, giving a pulsing heartbeat effect. This is a signature pattern in apps like Uber during ride-tracking.

### 5.2 Timer Display
**Current state:** The timer card shows the duration in plain text. It looks like a number, not a live timer.

**Improvements:**
- Style the timer digits with a **tabular/monospace** font variant so digits don't shift left/right as time changes. This requires a monospace font loaded via expo-font (e.g., `JetBrains Mono` or `Roboto Mono` for the timer only).
- Add a subtle **circular progress arc** (thin donut ring) around the timer text that fills up as time passes — based on a configurable session target (e.g., 2 hours expected). Use `react-native-svg` to draw the arc.

### 5.3 Estimated Fare
**Current state:** `₹{estimatedFare}` is shown at the bottom of the detail card, styled with `Colors.primary`.

**Improvements:**
- The fare should update with a brief **number-tick animation** each time it changes (using `Reanimated`'s shared value with `withSpring`).
- Add a small `(updated live)` note in `textTertiary` below the fare value.

### 5.4 Empty State
**Current state:** Shows a static car icon, text, and a CTA button. The icon circle uses `Colors.borderLight` background.

**Improvements:**
- Replace static icon with a **Lottie animation** — an empty parking lot animation (many free options on lottiefiles.com).
- The empty state layout should centre better vertically with proper padding accounting for the tab bar height.

### 5.5 Navigation to Lot
**Current state:** There is no "Navigate to Lot" button on the active session screen (it only exists on the Lot Detail screen).

**Improvement:**
- Add a secondary "Navigate to Lot" button below the detail card if `lot` data has coordinates.

---

## 6. History Screen (`(tabs)/history.tsx`)

### 6.1 Summary Stats Header
**Current state:** The screen jumps straight into a list. There is no summary at the top.

**Improvement:**
- Add a header summary row (scrolls with the list as part of `ListHeaderComponent`):
  - Total sessions count
  - Total amount spent (sum of all `fare` values in the loaded data)
  - Total hours parked
- Style this as a horizontal 3-stat row with the same `StatBox` pattern used in the Lot Detail screen.

### 6.2 Filtering & Grouping
**Current state:** A flat chronological list. No filtering, no date grouping.

**Improvements:**
- Add **filter tabs**: `All`, `Paid`, `Unpaid` at the top of the list.
- Group sessions by **month** (e.g., "March 2026" as a sticky section header) using `SectionList` instead of `FlatList`.

### 6.3 Card Detail Expansion
**Current state:** Cards are flat and non-interactive — no way to see more details.

**Improvement:**
- Make history cards **expandable/collapsible** on press. The collapsed state shows the lot name, plate, and fare. The expanded state reveals full entry/exit timestamps, duration breakdown, and a "Navigate to Lot" shortcut.
- Use `LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)` for a smooth expand/collapse.

### 6.4 Timestamp Formatting
**Current state:** `formatDateTime` returns a locale-dependent string that can be inconsistent across devices.

**Improvement:**
- Use a date library like `date-fns` (already likely bundled) with explicit locale formatting:
  ```ts
  format(new Date(iso), "dd MMM, hh:mm a")
  ```
  This gives consistent output like "15 Mar, 02:30 PM" regardless of device locale.

---

## 7. Wallet Screen (`(tabs)/wallet.tsx`)

### 7.1 Balance Card — No Gradient
**Current state:** The balance card is a flat `Colors.primary` blue card. It looks basic.

**Improvement:**
- Replace `backgroundColor: Colors.primary` with `<LinearGradient colors={["#2563EB", "#7C3AED"]} start={{x:0, y:0}} end={{x:1, y:1}}>`. The violet tint on the right makes it feel more financial/premium.
- Add a subtle pattern or abstract shape in the background of the card (e.g., faint circles) using `react-native-svg` or a static image overlay at low opacity.
- Add a wallet icon (or credit card icon) in the top-right of the balance card.

### 7.2 Top-Up Modal — Replace Native Modal
**Current state:** Uses React Native's `Modal` with `animationType="slide"`. This works but looks generic and can have issues on Android with keyboard interactions.

**Improvement:**
- Replace with `@gorhom/bottom-sheet` — the industry standard bottom sheet for React Native. It provides:
  - Physics-based gestures (draggable dismiss)
  - `BottomSheetTextInput` that handles keyboard insets correctly
  - Snap points configuration
- The modal handle bar is already designed (`modalHandle` style) — this translates directly.

### 7.3 Transaction List Enhancements
**Current state:** Transactions show description, date, and +/- amount. No categorisation.

**Improvements:**
- Add **filter tabs** above the transaction list: `All`, `Credits`, `Debits`.
- Show a **monthly total summary** at the top of each month's group (e.g., "March 2026 — Net: -₹240").
- Add a **running balance** per transaction row (greyed out on the right of date).

### 7.4 Payment Gateway Integration
**Current state:** A `TODO` comment notes that Razorpay/Stripe should be integrated before verifying.

**Improvement (spec only — no code change):**
- Integrate `react-native-razorpay` for Indian users (Razorpay supports UPI, cards, netbanking).
- The flow should be: tap "Add Money" → preset selection → Razorpay checkout opens natively → on success callback, call `verifyPayment` with the Razorpay `orderId` and `paymentId`.
- Show a success screen/animation after top-up (Lottie confetti or check animation).

---

## 8. Profile Screen (`(tabs)/profile.tsx`)

### 8.1 Avatar — No Photo Support
**Current state:** Shows the user's initial letter in a coloured circle.

**Improvement:**
- Add a "Change Photo" option via `expo-image-picker`. Show the selected photo as a circular avatar.
- If no photo is set, keep the initials avatar but allow choosing an avatar colour from a palette.

### 8.2 Edit Profile
**Current state:** No way to edit name, email, or phone number.

**Improvement:**
- Add an "Edit Profile" button (pencil icon) in the user card. Tapping it toggles inline editing of name and phone fields.
- Show a "Save" CTA that calls a `PUT /user/profile` endpoint (needs backend implementation).

### 8.3 Security Section
**Current state:** No security-related options.

**Improvement:**
- Add a "Security" section card below the vehicles section with:
  - Change Password (navigates to a `(auth)/change-password` screen)
  - Biometric login toggle (using `expo-local-authentication`)
  - Active sessions / "Sign out all devices" option

### 8.4 App Info Section
**Current state:** No version info or legal links.

**Improvement:**
- Add a footer section (no card, plain text):
  - App Version: `1.0.0` (read from `expo-constants`)
  - Privacy Policy link
  - Terms of Service link
  - Contact Support link

### 8.5 Logout Confirmation
**Current state:** Tapping "Log Out" logs the user out immediately without confirmation.

**Improvement:**
- Show a confirmation `Alert.alert("Log Out", "Are you sure you want to log out?", [...])` before calling `logout()`. This prevents accidental logouts.

---

## 9. Lot Detail Screen (`lot/[id].tsx`)

### 9.1 Lot Photo
**Current state:** No images. The screen goes straight to a header card with text.

**Improvement:**
- Add a photo section at the top — either pull a static image from the backend if the `ParkingLot` model is extended to store images, or use a Google Maps Static API image based on the lot's coordinates as a fallback.
- Implement with `expo-image` (not the React Native `Image`) for better caching and progressive loading.

### 9.2 Slot Capacity Visual
**Current state:** Slot breakdown uses `SlotBadge` components showing count + label. This is informational but not immediately scannable.

**Improvement:**
- Add a horizontal **segmented capacity bar** above or below the `SlotBadge` row for each vehicle type. Segments: green (available), orange (occupied), grey (maintenance). Use `View` with percentage-based `flex` values.

### 9.3 Pricing Card
**Current state:** Rate and free minutes are shown in `StatBox` components alongside available slots.

**Improvement:**
- Separate pricing into its own dedicated card below the header:
  - "First {freeMinutes} min free, then ₹{ratePerHour}/hr"
  - A small worked example: "e.g. 2h 30m = ₹{example_fare}" (computed client-side)
  - This reduces cognitive load for first-time users.

### 9.4 Navigate Button
**Current state:** The Navigate button is shown conditionally at the bottom. It's a full-width button.

**Improvement:**
- Move the Navigate button into the header card as an icon button next to the address row (matching Google Maps UI pattern). This frees up page real estate and feels more contextual.
- Add a secondary "Share Location" button to allow users to share the lot address via the native share sheet (`Share.share()`).

---

## 10. Parking Map Component (`components/ParkingMap.tsx`)

### 10.1 Custom Markers
**Current state:** Default red pins with a `MapCallout` popup.

**Improvement:**
- Replace with custom `Marker` using a `View`-based marker component that shows:
  - Green/red background based on `availableSlots > 0`
  - The price (e.g., `₹40`) in white text
  - A small car icon above the price pill
- This is the standard pattern used by parking apps like ParkWhiz and SpotHero.

### 10.2 Map Height & Layout
**Current state:** Fixed `height: 220`.

**Improvement:**
- Use `Dimensions.get("window").height * 0.3` for a proportional height.
- Add a collapse/expand toggle to make the map dismissible (shows chevron at bottom of map).
- When no lots are near the user, show a "No parking lots in this area" overlay on the map.

### 10.3 Web Fallback (`ParkingMap.web.tsx`)
**Current state:** This file presumably renders nothing or a placeholder. `react-native-maps` doesn't work on web.

**Improvement:**
- Replace with `react-leaflet` for web (or show a static `OpenStreetMap` tile image for the current coordinates using the `staticmap.openstreetmap.de` service).
- At minimum, render a `Text` component with an address list view as fallback.

---

## 11. Error Handling & Empty States

### 11.1 Network Error States
**Current state:** Most API calls have `catch { // silent }`. The user sees an empty list/screen with no indication of what went wrong.

**Improvement:**
- Define a reusable `<ErrorState message={string} onRetry={() => void} />` component with:
  - An error illustration (Lottie or static SVG)
  - Message text (e.g., "Couldn't load parking lots")
  - A "Try Again" button
- Replace all silent catches with an `error` state variable, and render `<ErrorState>` when it's set.

### 11.2 No Internet State
**Current state:** No offline detection.

**Improvement:**
- Use `@react-native-community/netinfo` to detect network state.
- Show a global banner at the top of the screen (not a modal) when offline: "You're offline. Showing cached data." with a yellow/amber background.

### 11.3 Consistency of Empty States
**Current state:** Different screens use different empty state patterns — some use icon circles, some use plain icons, some use different sizes.

**Improvement:**
- Create a reusable `<EmptyState icon={...} title={...} subtitle={...} action={...} />` component in `components/EmptyState.tsx` with a consistent layout used across Home, History, Active, and Wallet screens.

---

## 12. Animations & Micro-interactions

### 12.1 Screen Entry Animations
**Current state:** `react-native-reanimated` is imported in `_layout.tsx` (as required by the library) but is not used in any screen. Screens appear instantly with no entry transition.

**Improvement:**
- Use `Reanimated`'s `FadeInDown` entering animation on major content containers:
  - Auth screens: form card enters with `FadeInDown.springify()`
  - Tab screens: content area fades in on focus
  - Wallet balance card: slides in from the top on mount

### 12.2 List Item Animations
**Current state:** FlatList items all render at once with no stagger.

**Improvement:**
- Add staggered enter animations to list cards using `FadeInDown.delay(index * 60)` — this gives a cascading "waterfall" effect as the list populates. Keep delays short (max 300ms total) to avoid feeling slow.

### 12.3 Button Feedback
**Current state:** Buttons use `Pressable` with inline style overrides (`pressed && { backgroundColor: Colors.primaryDark }`). This is correct but subtle.

**Improvement:**
- Add **haptic feedback** to primary actions:
  ```ts
  import * as Haptics from "expo-haptics";
  // On CTA press:
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  ```
  Use `Light` for card taps, `Medium` for primary buttons, `Heavy` for destructive actions.

### 12.4 Skeleton Loaders
**Current state:** `ActivityIndicator` is used everywhere for loading states.

**Improvement:**
- Replace initial-load spinners with skeleton screens:
  - Home lot list: 4 skeleton cards with shimmer animation
  - History: 5 skeleton cards
  - Wallet: skeleton balance card + 4 skeleton transaction rows
- Implement using `Animated.Value` looping between opacity 0.3 and 0.7 to create a "shimmer" effect.

---

## 13. Accessibility

### 13.1 Missing `accessibilityLabel`
**Current state:** No `Pressable` or interactive element has an `accessibilityLabel`.

**Improvement (apply to all interactive elements):**
- Every `Pressable` must have `accessibilityLabel` and `accessibilityRole`.
- Examples:
  - Lot card: `accessibilityLabel={\`${item.name}, ${item.availableSlots} slots available\`} accessibilityRole="button"`
  - Logout button: `accessibilityLabel="Log out of account" accessibilityRole="button"`
  - Eye toggle: `accessibilityLabel={showPassword ? "Hide password" : "Show password"}`

### 13.2 Colour Contrast
**Current state:** `textTertiary: "#94A3B8"` on `surface: "#FFFFFF"` has a contrast ratio of ~3:1, below the WCAG AA minimum of 4.5:1 for normal text.

**Improvement:**
- Darken `textTertiary` to `"#6B7280"` (contrast ~4.6:1 on white) for body-size text.
- Keep `#94A3B8` only for decorative/icon elements where contrast requirements are lower.

### 13.3 Touch Target Sizes
**Current state:** Several icon buttons (e.g., the search clear button, the add/remove vehicle icons) are 18–20px icons without sufficient hit area.

**Improvement:**
- All tappable icons should have a minimum 44×44pt touch target. Use `hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}` on small icon `Pressable` elements.
- The `hitSlop={8}` shorthand (number) is less precise — prefer the object form with explicit per-side values.

---

## 14. Code Quality & Architecture

### 14.1 Shared `InputField` Component
**Current state:** `InputField` is defined as a local component inside `register.tsx`. `login.tsx` duplicates the same pattern inline.

**Improvement:**
- Move `InputField` to `components/InputField.tsx`.
- Extend it to support: `focusedBorderColor`, `errorMessage`, `isPassword` (show/hide toggle), `onSubmitEditing` (to chain focus between fields with `returnKeyType`).

### 14.2 Reusable `SectionCard` Component
**Current state:** The same card pattern (`backgroundColor: Colors.surface, borderRadius: BorderRadius.xl, padding, ...Shadows.sm`) is copy-pasted across nearly every screen.

**Improvement:**
- Create `components/SectionCard.tsx`:
  ```tsx
  export function SectionCard({ children, style }: { children: ReactNode; style?: ViewStyle }) {
    return <View style={[styles.card, style]}>{children}</View>;
  }
  ```

### 14.3 Error Boundaries
**Current state:** No error boundaries exist. A crash in any screen component propagates up and kills the app.

**Improvement:**
- Wrap each tab screen in an `ErrorBoundary` component (class component or `react-error-boundary` library) that catches render errors and shows a friendly "Something went wrong" fallback with a reload button.

### 14.4 API Error Handling Utility
**Current state:** Error messages are extracted with `err.response?.data?.message || "fallback"` duplicated in every catch block.

**Improvement:**
- Add a utility function:
  ```ts
  export function getApiError(err: unknown, fallback = "Something went wrong"): string {
    if (axios.isAxiosError(err)) return err.response?.data?.message ?? fallback;
    if (err instanceof Error) return err.message;
    return fallback;
  }
  ```
- Use this everywhere instead of inline chained optional access.

### 14.5 Remove Hardcoded IP
**Current state:** `config.ts` has `DEFAULT_NATIVE_API_BASE_URL = "http://10.56.209.207:5000/api"` — a local dev machine IP hardcoded in source.

**Improvement:**
- Change the fallback to `"http://localhost:5000/api"` and document in the README that developers must set `EXPO_PUBLIC_API_BASE_URL` for native testing on a physical device.
- Alternatively, use `Constants.expoConfig?.hostUri` to derive the dev server host dynamically.

### 14.6 Replace `Alert.alert` with Unified `showAlert`
**Current state:** Most screens use `showAlert` from `@/utils/alert` (good), but `wallet.tsx` and `profile.tsx` import `Alert` from React Native directly and use it inline.

**Improvement:**
- Audit all screens: replace all direct `Alert.alert(...)` calls with `showAlert(...)` from `@/utils/alert` for consistency. This also makes it easier to swap in a toast library later.

---

## 15. Onboarding & First-Run Experience

### 15.1 Splash Screen
**Current state:** The splash icon is a generic image with white background. Dark mode splash uses black background with no icon styling.

**Improvement:**
- Create a branded splash: the parking app icon centred with the app name below it in the brand blue.
- The splash background colour should match `Colors.primary` (`#2563EB`) for a bold, brand-consistent first impression.

### 15.2 Onboarding Carousel
**Current state:** New users go directly from register → link-vehicle → home with no explanation of how the app works.

**Improvement:**
- Add a 3-screen onboarding carousel shown only on first launch (tracked via `AsyncStorage`):
  1. "Find Parking Nearby" — map with pins illustration
  2. "Park & Go" — ANPR camera illustration
  3. "Pay Automatically" — wallet illustration
- Use `react-native-onboarding-swiper` or a custom `FlatList`-based carousel with pagination dots.

### 15.3 Post-Registration Deep Link
**Current state:** After registration, the user is routed to `/(auth)/link-vehicle` — a good step. But if they skip, they land on the home screen with no in-app guidance.

**Improvement:**
- Show a **welcome tooltip** or **coach mark** overlay on the home screen for first-time users highlighting the search bar and map toggle. Dismiss on first interaction.

---

## 16. Performance

### 16.1 List Rendering Optimisations
**Current state:** `FlatList` in Home and History screens has no `maxToRenderPerBatch`, `windowSize`, or `initialNumToRender` tuning.

**Improvement:**
- Set:
  ```tsx
  initialNumToRender={8}
  maxToRenderPerBatch={8}
  windowSize={10}
  removeClippedSubviews={true}
  ```
- Use `React.memo` on the renderItem components (lot card, history card, transaction row) to prevent unnecessary re-renders during scroll.

### 16.2 Image Caching
**Current state:** No images are loaded currently. When lot photos are added, use `expo-image` instead of React Native's `Image` for built-in disk and memory caching, blurhash placeholders, and progressive loading.

### 16.3 API Response Caching
**Current state:** Every `useFocusEffect` triggers a full API call with no caching.

**Improvement:**
- Introduce `@tanstack/react-query` (React Query) for all API calls. Benefits:
  - Automatic background refetching on focus
  - Cache invalidation
  - Loading/error/success states out of the box
  - Eliminates all the `useState(loading)`, `useState(refreshing)` boilerplate

---

## Priority Matrix

| Priority | Item |
|----------|------|
| P0 (critical) | Dark mode implementation, Input focus states, Error states (non-silent catches), `accessibilityLabel` on all interactives |
| P1 (high) | Custom fonts, Gradient wallet card, Skeleton loaders, Haptic feedback, Bottom sheet for top-up, Live badge pulse animation |
| P2 (medium) | Edit profile, History filters + grouping, Lot card capacity bar, Distance indicator, Custom map markers, Lot detail photo |
| P3 (polish) | Onboarding carousel, Lottie animations, React Query migration, SectionCard refactor, Password strength indicator |
