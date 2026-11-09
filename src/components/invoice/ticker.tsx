"use client";
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

const DIGITS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];

/**
 * Signature move: the grand total resolves digit by digit. Each digit is a
 * vertical strip that rolls to its value in 150ms; separators stay put.
 * Digits are keyed from the right so a growing total rolls in from the left.
 */
export function Ticker({ value, className }: { value: string; className?: string }) {
  const chars = value.split("");
  return (
    <span className={cn("num inline-flex items-end leading-none", className)} aria-label={value} role="text">
      {chars.map((c, i) => {
        const key = chars.length - i;
        if (!/\d/.test(c))
          return (
            <span key={`s${key}`} aria-hidden className="inline-block h-[1em] leading-none">
              {c}
            </span>
          );
        return (
          <span key={`d${key}`} aria-hidden className="relative inline-block h-[1em] w-[1ch] overflow-hidden">
            <span
              className="absolute inset-x-0 top-0 flex flex-col transition-transform duration-150 ease-out-expo"
              style={{ transform: `translateY(-${Number(c) * 10}%)` }}
            >
              {DIGITS.map((d) => (
                <span key={d} className="block h-[1em] leading-none">
                  {d}
                </span>
              ))}
            </span>
          </span>
        );
      })}
    </span>
  );
}

/** Flashes amber once whenever `value` changes (never on first render). */
export function Flash({ value, children, className }: { value: string; children: ReactNode; className?: string }) {
  const [prev, setPrev] = useState(value);
  const [n, setN] = useState(0);
  if (value !== prev) {
    setPrev(value);
    setN(n + 1);
  }
  return (
    <span key={n} className={cn("-mx-1 rounded px-1", n > 0 && "animate-flash", className)}>
      {children}
    </span>
  );
}
