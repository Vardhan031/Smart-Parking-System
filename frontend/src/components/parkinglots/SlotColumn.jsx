import ParkingSlot from "./ParkingSlot";

export default function SlotColumn({ slots }) {
    return (
        <div className="flex flex-col gap-6">
            {slots.map((slot) => (
                <ParkingSlot key={slot.id} {...slot} />
            ))}
        </div>
    );
}
