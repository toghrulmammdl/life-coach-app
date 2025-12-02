import React, { useState, useEffect, useRef } from 'react';

interface AnimatedNumberProps {
    value: number;
    duration?: number;
}

const AnimatedNumber: React.FC<AnimatedNumberProps> = ({ value, duration = 500 }) => {
    const [displayValue, setDisplayValue] = useState(value);
    const prevValueRef = useRef(value);

    useEffect(() => {
        const startValue = prevValueRef.current;
        let startTimestamp: number | null = null;

        const step = (timestamp: number) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);
            const nextValue = Math.floor(progress * (value - startValue) + startValue);
            setDisplayValue(nextValue);

            if (progress < 1) {
                requestAnimationFrame(step);
            }
        };

        requestAnimationFrame(step);
        prevValueRef.current = value;
    }, [value, duration]);

    return <>{displayValue}</>;
};

export default AnimatedNumber;