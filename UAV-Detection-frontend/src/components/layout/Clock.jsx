import { useState, useEffect } from "react";

export default function Clock() {
    const [time, setTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(timer); // อย่าลืมคลีนอัพ
    }, []);

    return <span className="text-lg font-mono text-slate-300">{time.toLocaleTimeString('th-TH')}</span>;
}