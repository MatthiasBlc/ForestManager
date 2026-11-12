import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { api } from "../lib/api.ts";
import { OfflineBanner } from "./offline-banner.tsx";
import { UpdateBanner } from "./update-banner.tsx";

function setOnline(online: boolean) {
  Object.defineProperty(navigator, "onLine", { configurable: true, get: () => online });
  window.dispatchEvent(new Event(online ? "online" : "offline"));
}

afterEach(() => {
  setOnline(true);
});

describe("hors ligne (D35, D106)", () => {
  it("bandeau visible hors ligne, retire au retour du reseau", () => {
    render(<OfflineBanner />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    act(() => setOnline(false));
    expect(screen.getByRole("status")).toHaveTextContent("Hors ligne");
    act(() => setOnline(true));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("une ecriture hors ligne echoue tout de suite, sans file d'attente", async () => {
    setOnline(false);
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    await expect(api.post("/spaces", { name: "Famille" })).rejects.toMatchObject({
      code: "OFFLINE",
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});

describe("nouvelle version", () => {
  it("propose de recharger", async () => {
    const onReload = vi.fn();
    render(<UpdateBanner needRefresh onReload={onReload} onDismiss={() => undefined} />);
    expect(screen.getByRole("status")).toHaveTextContent("Nouvelle version disponible");
    await userEvent.click(screen.getByRole("button", { name: "Recharger" }));
    expect(onReload).toHaveBeenCalledOnce();
  });

  it("rien sans nouvelle version", () => {
    render(
      <UpdateBanner needRefresh={false} onReload={() => undefined} onDismiss={() => undefined} />
    );
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
