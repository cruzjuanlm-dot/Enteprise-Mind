"use client";

import { useRef, useState } from "react";
import { ValueCycleFigure } from "@/components/value-cycle-figure";
import { getStation, stations, type StationId } from "@/lib/cycle";

export function ValueCycleExplorer() {
  const [active, setActive] = useState<StationId>("outside");
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);
  const station = getStation(active);
  const turn = stations.filter((item) => item.group === "turn");
  const measures = stations.filter((item) => item.group === "measure");

  function move(index: number, key: string) {
    if (key !== "ArrowDown" && key !== "ArrowUp" && key !== "ArrowRight" && key !== "ArrowLeft") {
      return;
    }
    const delta = key === "ArrowDown" || key === "ArrowRight" ? 1 : -1;
    const next = (index + delta + stations.length) % stations.length;
    const id = stations[next]?.id;
    if (!id) return;
    setActive(id);
    buttons.current[next]?.focus();
  }

  function renderButtons(items: typeof stations) {
    return items.map((item) => {
      const index = stations.findIndex((stationItem) => stationItem.id === item.id);
      return (
        <button
          key={item.id}
          type="button"
          ref={(node) => {
            buttons.current[index] = node;
          }}
          aria-pressed={active === item.id}
          onClick={() => setActive(item.id)}
          onKeyDown={(event) => {
            if (
              event.key === "ArrowDown" ||
              event.key === "ArrowUp" ||
              event.key === "ArrowRight" ||
              event.key === "ArrowLeft"
            ) {
              event.preventDefault();
              move(index, event.key);
            }
          }}
        >
          {item.group === "turn" ? `${index + 1}. ${item.name}` : item.name}
        </button>
      );
    });
  }

  return (
    <div className="cycle" id="stations">
      <ValueCycleFigure active={active} />
      <div className="station-list">
        <div>
          <p className="kicker" id="turn-label">
            The turn
          </p>
          <div className="station-buttons" role="group" aria-labelledby="turn-label">
            {renderButtons(turn)}
          </div>
        </div>
        <div>
          <p className="kicker" id="measure-label">
            The measures
          </p>
          <div className="station-buttons" role="group" aria-labelledby="measure-label">
            {renderButtons(measures)}
          </div>
        </div>
        <p className="note">Arrow keys move between parts.</p>
        <div className="panel" aria-live="polite">
          <h2>{station.name}</h2>
          <p>{station.text}</p>
        </div>
      </div>
    </div>
  );
}
