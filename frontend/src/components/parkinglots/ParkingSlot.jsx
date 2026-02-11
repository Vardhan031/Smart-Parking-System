const CarShape = ({ color }) => {
    const colorMap = {
        red: "fill-car-red",
        white: "fill-car-white",
        black: "fill-car-black",
    };
    const fill = colorMap[color] || colorMap.white;

    return (
        <svg viewBox="0 0 60 100" className="w-10 h-16 mx-auto">
            {/* Car body */}
            <rect x="8" y="20" width="44" height="60" rx="10" className={`${fill} opacity-80`} />
            {/* Roof / cabin */}
            <rect x="14" y="32" width="32" height="28" rx="6" className="fill-background opacity-40" />
            {/* Headlights */}
            <circle cx="16" cy="24" r="3" className="fill-yellow-400 opacity-70" />
            <circle cx="44" cy="24" r="3" className="fill-yellow-400 opacity-70" />
            {/* Taillights */}
            <circle cx="16" cy="76" r="3" className="fill-red-500 opacity-60" />
            <circle cx="44" cy="76" r="3" className="fill-red-500 opacity-60" />
            {/* Wheels */}
            <rect x="4" y="28" width="6" height="12" rx="2" className="fill-foreground opacity-20" />
            <rect x="50" y="28" width="6" height="12" rx="2" className="fill-foreground opacity-20" />
            <rect x="4" y="60" width="6" height="12" rx="2" className="fill-foreground opacity-20" />
            <rect x="50" y="60" width="6" height="12" rx="2" className="fill-foreground opacity-20" />
        </svg>
    );
};

const ParkingSlot = ({ id, occupied, carColor }) => {
    return (
        <div
            className={`
        relative w-24 h-36 rounded-lg border-2 flex flex-col items-center justify-center
        parking-slot-glow cursor-pointer
        ${occupied
                    ? "bg-parking-slot-occupied border-parking-slot-border"
                    : "bg-transparent border-parking-slot-border border-dashed"
                }
      `}
        >
            {occupied && <CarShape color={carColor} />}
            <span className="absolute bottom-2 text-xs font-mono tracking-wider text-muted-foreground">
                {id}
            </span>
        </div>
    );
};

export default ParkingSlot;

