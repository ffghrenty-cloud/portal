"use client";

import { useEffect, useRef, useState } from "react";

type Stat = {
  value: string;
  label: string;
};

const INITIAL_STATS: Stat[] = [
  { value: "90+", label: "лет производства" },
  { value: "30+", label: "видов продукции" },
  { value: "1 000+", label: "оптовых заказчиков" },
  { value: "24/7", label: "отслеживание заказов" },
];

export default function StatsCarousel() {
  const [order, setOrder] = useState<number[]>([0, 1, 2, 3]);
  const [animate, setAnimate] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setAnimate(true);

      timeoutRef.current = setTimeout(() => {
        setOrder((prev) => {
          const [first, ...rest] = prev;
          return [...rest, first];
        });
        setAnimate(false);
      }, 900); // длительность каскада (последняя карточка + её delay)
    }, 3000);

    return () => {
      clearInterval(interval);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return (
    <section className="stats">
      <div className="stats-viewport">
        <div className="stats-track">
          {order.map((idx, i) => (
            <div
              className={`stat-item ${animate ? "stat-item-out" : ""}`}
              key={idx}
              style={{ transitionDelay: `${i * 80}ms` }}
            >
              <b>{INITIAL_STATS[idx].value}</b>
              <span>{INITIAL_STATS[idx].label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}