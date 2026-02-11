import ParkingSlot from "./ParkingSlot";
import Lane from "./Lane";

const COLUMNS = [
    {
        label: "A",
        slots: [
            { id: "A1", occupied: true, carColor: "red" },
            { id: "A2", occupied: false },
            { id: "A3", occupied: true, carColor: "white" },
            { id: "A4", occupied: false },
            { id: "A5", occupied: true, carColor: "black" },
            { id: "A6", occupied: false },
        ],
    },
    {
        label: "B",
        slots: [
            { id: "B1", occupied: false },
            { id: "B2", occupied: true, carColor: "white" },
            { id: "B3", occupied: true, carColor: "red" },
            { id: "B4", occupied: false },
            { id: "B5", occupied: false },
            { id: "B6", occupied: true, carColor: "black" },
        ],
    },
    {
        label: "C",
        slots: [
            { id: "C1", occupied: true, carColor: "black" },
            { id: "C2", occupied: true, carColor: "red" },
            { id: "C3", occupied: false },
            { id: "C4", occupied: true, carColor: "white" },
            { id: "C5", occupied: false },
            { id: "C6", occupied: false },
        ],
    },
    {
        label: "D",
        slots: [
            { id: "D1", occupied: false },
            { id: "D2", occupied: false },
            { id: "D3", occupied: true, carColor: "red" },
            { id: "D4", occupied: true, carColor: "white" },
            { id: "D5", occupied: true, carColor: "black" },
            { id: "D6", occupied: false },
        ],
    },
];

const SlotColumn = ({ column, side }) => (
    <div className="flex flex-col gap-3 items-center">
        <span className="text-xs font-bold tracking-widest text-muted-foreground mb-1">
            {column.label}
        </span>
        {column.slots.map((slot) => (
            <ParkingSlot key={slot.id} {...slot} />
        ))}
    </div>
);

const ParkingGrid = () => {
    return (
        <div className="min-h-screen bg-parking-bg flex flex-col items-center justify-center p-8">
            {/* Header */}
            <div className="mb-8 text-center">
                <h1 className="text-2xl font-bold tracking-wide text-foreground">
                    Basement Level B1
                </h1>
                <p className="text-sm text-muted-foreground mt-1 font-mono">
                    {COLUMNS.reduce((acc, col) => acc + col.slots.filter(s => !s.occupied).length, 0)} slots available
                </p>
            </div>

            {/* Parking layout */}
            <div className="relative bg-parking-lane/30 rounded-2xl border border-parking-line p-6 overflow-x-auto">
                <div className="flex items-stretch gap-0">
                    {/* Left entry indicator */}
                    <div className="flex flex-col items-center justify-center px-3">
                        <span className="text-parking-arrow font-mono text-lg select-none">▶</span>
                        <span className="text-[10px] text-muted-foreground mt-1 font-mono">IN</span>
                    </div>

                    {COLUMNS.map((col, i) => (
                        <div key={col.label} className="flex items-stretch">
                            {/* Slot column */}
                            <SlotColumn column={col} />

                            {/* Lane between columns */}
                            {i < COLUMNS.length - 1 && (
                                <div className="mx-2">
                                    <Lane direction={i % 2 === 0 ? "down" : "up"} />
                                </div>
                            )}
                        </div>
                    ))}

                    {/* Right exit indicator */}
                    <div className="flex flex-col items-center justify-center px-3">
                        <span className="text-parking-arrow font-mono text-lg select-none">▶</span>
                        <span className="text-[10px] text-muted-foreground mt-1 font-mono">OUT</span>
                    </div>
                </div>
            </div>

            {/* Legend */}
            <div className="mt-6 flex gap-6 text-xs text-muted-foreground font-mono">
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded border-2 border-dashed border-parking-slot-border" />
                    <span>Available</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded border-2 border-parking-slot-border bg-parking-slot-occupied" />
                    <span>Occupied</span>
                </div>
            </div>
        </div>
    );
};

export default ParkingGrid;
