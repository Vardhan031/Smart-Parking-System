const Lane = ({ direction = "down" }) => {
    const arrows = direction === "down" ? "▼  ▼  ▼" : "▲  ▲  ▲";

    return (
        <div className="flex flex-col items-center justify-center w-20 h-full min-h-[200px] relative">
            {/* Lane surface */}
            <div className="absolute inset-0 bg-parking-lane rounded" />
            {/* Center dashed line */}
            <div className="absolute inset-y-4 left-1/2 -translate-x-px w-0.5 border-l-2 border-dashed border-parking-line" />
            {/* Direction arrows */}
            <span className="relative z-10 text-parking-arrow text-sm font-mono tracking-widest whitespace-pre writing-mode-vertical rotate-0 select-none">
                {arrows}
            </span>
        </div>
    );
};

export default Lane;
