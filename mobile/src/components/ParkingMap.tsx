import MapView, { Marker } from "react-native-maps";
import { StyleSheet } from "react-native";

interface MapLot {
  _id: string;
  name: string;
  location: { latitude: number; longitude: number };
  pricing: { ratePerHour: number };
  availableSlots?: number;
}

interface ParkingMapProps {
  latitude: number;
  longitude: number;
  lots: MapLot[];
  onLotPress: (lotId: string) => void;
}

export default function ParkingMap({
  latitude,
  longitude,
  lots,
  onLotPress,
}: ParkingMapProps) {
  return (
    <MapView
      style={styles.map}
      initialRegion={{
        latitude,
        longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      }}
      showsUserLocation
    >
      {lots.map((lot) =>
        lot.location?.latitude && lot.location?.longitude ? (
          <Marker
            key={lot._id}
            coordinate={{
              latitude: lot.location.latitude,
              longitude: lot.location.longitude,
            }}
            title={lot.name}
            description={`₹${lot.pricing.ratePerHour}/hr · ${lot.availableSlots ?? "?"} available`}
            onCalloutPress={() => onLotPress(lot._id)}
          />
        ) : null
      )}
    </MapView>
  );
}

const styles = StyleSheet.create({
  map: { height: 220 },
});
