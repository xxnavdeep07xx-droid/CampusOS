"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bus, Loader2, MapPin, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import type { TransportRoute, TransportStop } from "@/lib/types";
import { formatTime } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * TransportAdminClient — the admin transport management interface.
 *
 * Two forms:
 *   1. Create Route: route name + vehicle number + driver name + phone.
 *   2. Add Stop: select route + stop name + pickup time + drop time.
 *
 * Below the forms: a data table of routes with their stops.
 */
export function TransportAdminClient({
  schoolId,
  initialRoutes,
}: {
  schoolId: string;
  initialRoutes: Array<TransportRoute & { stops?: TransportStop[] }>;
}) {
  const router = useRouter();
  const [routes, setRoutes] = useState(initialRoutes);

  // Route form state.
  const [routeName, setRouteName] = useState("");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [driverName, setDriverName] = useState("");
  const [driverPhone, setDriverPhone] = useState("");
  const [creatingRoute, setCreatingRoute] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);

  // Stop form state.
  const [selectedRouteId, setSelectedRouteId] = useState("");
  const [stopName, setStopName] = useState("");
  const [pickupTime, setPickupTime] = useState("");
  const [dropTime, setDropTime] = useState("");
  const [creatingStop, setCreatingStop] = useState(false);
  const [stopError, setStopError] = useState<string | null>(null);

  // Deleting stop.
  const [deletingStopId, setDeletingStopId] = useState<string | null>(null);

  async function handleCreateRoute(e: React.FormEvent) {
    e.preventDefault();
    if (!routeName.trim()) { setRouteError("Route name is required."); return; }
    setCreatingRoute(true); setRouteError(null);
    try {
      const res = await fetch("/api/transport-routes", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schoolId, routeName: routeName.trim(),
          vehicleNumber: vehicleNumber.trim(), driverName: driverName.trim(),
          driverPhone: driverPhone.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Failed (HTTP ${res.status})`);
      setRouteName(""); setVehicleNumber(""); setDriverName(""); setDriverPhone("");
      router.refresh();
    } catch (err) {
      setRouteError(err instanceof Error ? err.message : String(err));
    } finally { setCreatingRoute(false); }
  }

  async function handleAddStop(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedRouteId || !stopName.trim()) { setStopError("Select a route and enter a stop name."); return; }
    setCreatingStop(true); setStopError(null);
    try {
      const res = await fetch("/api/transport-stops", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          routeId: selectedRouteId, stopName: stopName.trim(),
          pickupTime: pickupTime || undefined, dropTime: dropTime || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Failed (HTTP ${res.status})`);
      setStopName(""); setPickupTime(""); setDropTime("");
      router.refresh();
    } catch (err) {
      setStopError(err instanceof Error ? err.message : String(err));
    } finally { setCreatingStop(false); }
  }

  async function handleDeleteStop(stopId: string) {
    setDeletingStopId(stopId);
    try {
      const res = await fetch(`/api/transport-stops/${stopId}`, { method: "DELETE" });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || `Failed (HTTP ${res.status})`);
      }
      router.refresh();
    } catch (err) {
      setStopError(err instanceof Error ? err.message : String(err));
    } finally { setDeletingStopId(null); }
  }

  return (
    <div className="space-y-6">
      {/* Create Route form */}
      <Card className="overflow-hidden">
        <div className="h-2 w-full border-x-2 border-t-2 border-slate-900 bg-sky-300" />
        <CardContent className="space-y-4 py-4">
          <h2 className="flex items-center gap-2 text-lg font-black uppercase tracking-tight">
            <Bus className="size-5" strokeWidth={2.5} /> Create Bus Route
          </h2>
          <form onSubmit={handleCreateRoute} className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="r-name">Route Name</Label>
              <Input id="r-name" value={routeName} onChange={(e) => setRouteName(e.target.value)} placeholder="e.g. Route A — North Campus" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="r-vehicle">Vehicle Number</Label>
              <Input id="r-vehicle" value={vehicleNumber} onChange={(e) => setVehicleNumber(e.target.value)} placeholder="e.g. BUS-001" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="r-driver">Driver Name</Label>
              <Input id="r-driver" value={driverName} onChange={(e) => setDriverName(e.target.value)} placeholder="e.g. John Smith" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="r-phone">Driver Phone</Label>
              <Input id="r-phone" value={driverPhone} onChange={(e) => setDriverPhone(e.target.value)} placeholder="e.g. +1 555-0100" />
            </div>
            <div className="md:col-span-2 flex items-center gap-3">
              <Button type="submit" variant="sky" disabled={creatingRoute || !routeName.trim()}>
                {creatingRoute ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                Create Route
              </Button>
              {routeError && <span className="text-xs font-bold text-rose-700">{routeError}</span>}
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Add Stop form */}
      {routes.length > 0 && (
        <Card className="overflow-hidden">
          <div className="h-2 w-full border-x-2 border-t-2 border-slate-900 bg-emerald-500" />
          <CardContent className="space-y-4 py-4">
            <h2 className="flex items-center gap-2 text-lg font-black uppercase tracking-tight">
              <MapPin className="size-5" strokeWidth={2.5} /> Add Stop
            </h2>
            <form onSubmit={handleAddStop} className="grid gap-3 md:grid-cols-4">
              <div className="space-y-2">
                <Label htmlFor="s-route">Route</Label>
                <Select value={selectedRouteId} onValueChange={setSelectedRouteId}>
                  <SelectTrigger id="s-route"><SelectValue placeholder="Select route" /></SelectTrigger>
                  <SelectContent>
                    {routes.map((r) => <SelectItem key={r.id} value={r.id}>{r.route_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="s-name">Stop Name</Label>
                <Input id="s-name" value={stopName} onChange={(e) => setStopName(e.target.value)} placeholder="e.g. Main Gate" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="s-pickup">Pickup Time</Label>
                <Input id="s-pickup" type="time" value={pickupTime} onChange={(e) => setPickupTime(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="s-drop">Drop Time</Label>
                <Input id="s-drop" type="time" value={dropTime} onChange={(e) => setDropTime(e.target.value)} />
              </div>
              <div className="md:col-span-4 flex items-center gap-3">
                <Button type="submit" variant="emerald" disabled={creatingStop || !selectedRouteId || !stopName.trim()}>
                  {creatingStop ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                  Add Stop
                </Button>
                {stopError && <span className="text-xs font-bold text-rose-700">{stopError}</span>}
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Routes + stops table */}
      <div className="space-y-3">
        <h2 className="text-lg font-black uppercase tracking-tight">All Routes ({routes.length})</h2>
        {routes.length === 0 ? (
          <Card><CardContent className="py-8 text-center">
            <Bus className="mx-auto mb-2 size-8 text-slate-400" />
            <p className="text-sm font-bold text-slate-700">No routes yet</p>
            <p className="mt-1 text-xs font-medium text-slate-500">Create a bus route above to get started.</p>
          </CardContent></Card>
        ) : (
          <div className="space-y-3">
            {routes.map((route) => (
              <Card key={route.id} className="overflow-hidden">
                <div className="h-1.5 w-full border-x-2 border-t-2 border-slate-900 bg-sky-300" />
                <CardContent className="py-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-black uppercase tracking-tight text-slate-900">{route.route_name}</h3>
                      <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        <span>{route.vehicle_number || "—"}</span>
                        <span>·</span>
                        <span>{route.driver_name || "No driver"}</span>
                        {route.driver_phone && (<><span>·</span><span>{route.driver_phone}</span></>)}
                      </div>
                    </div>
                    <span className="rounded-full border-2 border-slate-900 bg-amber-200 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider">
                      {(route.stops ?? []).length} stops
                    </span>
                  </div>
                  {/* Stops timeline */}
                  {(route.stops ?? []).length > 0 && (
                    <div className="mt-3 grid gap-2 md:grid-cols-3 lg:grid-cols-4">
                      {(route.stops ?? []).map((stop) => (
                        <div key={stop.id} className="flex items-center gap-2 rounded-lg border-2 border-slate-900 bg-[#FDFBF7] p-2">
                          <MapPin className="size-4 shrink-0 text-emerald-600" />
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-xs font-bold text-slate-900">{stop.stop_name}</div>
                            <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500">
                              {stop.pickup_time ? `↑ ${formatTime(stop.pickup_time)}` : ""}
                              {stop.pickup_time && stop.drop_time ? " · " : ""}
                              {stop.drop_time ? `↓ ${formatTime(stop.drop_time)}` : ""}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDeleteStop(stop.id)}
                            disabled={deletingStopId === stop.id}
                            className="rounded-md border-2 border-slate-900 bg-rose-100 p-1 transition-all hover:bg-rose-400 hover:text-[#FDFBF7] disabled:opacity-50"
                            aria-label="Delete stop"
                          >
                            {deletingStopId === stop.id ? <Loader2 className="size-3 animate-spin" /> : <Trash2 className="size-3" />}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
