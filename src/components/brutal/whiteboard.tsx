"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Brush,
  Circle as CircleIcon,
  Download,
  Eraser,
  Highlighter,
  Loader2,
  Minus,
  Pencil,
  Redo2,
  Square,
  Type,
  Undo2,
  Trash2,
  Upload,
  Grid3x3,
  AlignJustify,
  PanelsTopLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToolButton, ToolDivider } from "@/components/brutal/tool-button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { WhiteboardTool, WhiteboardBackground } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Whiteboard — full-screen digital board component.
 *
 * Architecture:
 *   - Two stacked canvases:
 *     - `bgCanvasRef`   — painted once per background-mode change
 *       (white / grid / lined / chalkboard). Static.
 *     - `drawCanvasRef` — receives pointer events + holds the persistent
 *       drawing. Cleared + redrawn on every pointermove during a shape draw.
 *   - `strokeBufferRef` — accumulates the in-progress stroke's points so we
 *     can render smooth lines via quadraticCurveTo.
 *   - `historyRef`      — array of ImageData snapshots (undo/redo stack).
 *     On every stroke commit we push a snapshot. Undo pops one back.
 *
 * Tools:
 *   - pen         — solid opaque strokes
 *   - highlighter — wide + low alpha
 *   - eraser      — uses destination-out composite to "erase" pixels
 *   - rectangle   — previewed live during drag
 *   - circle      — previewed live during drag
 *   - line        — previewed live during drag
 *   - text        — click-to-place; opens a small inline input
 *
 * Backgrounds:
 *   - white       — clean white
 *   - grid        — graph-paper grid
 *   - lined       — horizontal ruled lines
 *   - chalkboard  — dark green/black, stroke color auto-inverts to white
 *
 * Export:
 *   - "Export & Share with Class" button calls canvas.toDataURL('image/png')
 *     and POSTs it to /api/whiteboard/export (which uploads to class_materials
 *     and creates a resources row). Students don't see this button — they
 *     get a read-only board.
 */
const PEN_COLORS = [
  "#0f172a", // slate-900 (default ink)
  "#dc2626", // red
  "#f59e0b", // amber
  "#10b981", // emerald
  "#3b82f6", // blue
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#ffffff", // white (for chalkboard mode)
];

const PEN_WIDTHS = [2, 4, 8, 14];
const HIGHLIGHTER_WIDTHS = [10, 20, 30];

export function Whiteboard({
  classId,
  className,
  canEdit = true,
}: {
  classId: string;
  className: string;
  canEdit?: boolean;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const bgCanvasRef = useRef<HTMLCanvasElement>(null);
  const drawCanvasRef = useRef<HTMLCanvasElement>(null);

  const [tool, setTool] = useState<WhiteboardTool>("pen");
  const [color, setColor] = useState<string>(PEN_COLORS[0]);
  const [width, setWidth] = useState<number>(4);
  const [background, setBackground] = useState<WhiteboardBackground>("white");

  // Drawing state.
  const strokeBufferRef = useRef<Array<[number, number]>>([]);
  const drawingRef = useRef(false);
  const shapeStartRef = useRef<[number, number] | null>(null);

  // History stack (undo/redo). Each entry is a base64 PNG snapshot of the
  // drawCanvas. We keep up to 30 snapshots to bound memory.
  const historyRef = useRef<string[]>([]);
  const historyIdxRef = useRef<number>(-1);
  const [, forceRerender] = useState(0);

  // Text-tool state.
  const [textInputAt, setTextInputAt] = useState<{ x: number; y: number } | null>(null);
  const [textInputValue, setTextInputValue] = useState("");

  // Export state.
  const [exportOpen, setExportOpen] = useState(false);
  const [exportTitle, setExportTitle] = useState("");
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportSuccess, setExportSuccess] = useState(false);

  // ----- Canvas sizing -----
  const resizeCanvases = useCallback(() => {
    const wrap = wrapRef.current;
    const bgCanvas = bgCanvasRef.current;
    const drawCanvas = drawCanvasRef.current;
    if (!wrap || !bgCanvas || !drawCanvas) return;

    const dpr = window.devicePixelRatio || 1;
    const w = wrap.clientWidth;
    const h = wrap.clientHeight;

    // Preserve the existing drawing across resizes: snapshot, resize, restore.
    const prevSnapshot = drawCanvas.toDataURL("image/png");

    [bgCanvas, drawCanvas].forEach((c) => {
      c.width = Math.floor(w * dpr);
      c.height = Math.floor(h * dpr);
      c.style.width = `${w}px`;
      c.style.height = `${h}px`;
      const ctx = c.getContext("2d");
      if (ctx) ctx.scale(dpr, dpr);
    });

    // Restore drawing (the bg canvas will be repainted separately).
    const drawCtx = drawCanvas.getContext("2d");
    if (drawCtx && prevSnapshot && prevSnapshot !== "data:,") {
      const img = new Image();
      img.onload = () => {
        drawCtx.drawImage(img, 0, 0, w, h);
      };
      img.src = prevSnapshot;
    }

    paintBackground();
  }, []);

  // ----- Background painting -----
  const paintBackground = useCallback(() => {
    const bg = bgCanvasRef.current;
    if (!bg) return;
    const ctx = bg.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = bg.width / dpr;
    const h = bg.height / dpr;

    ctx.clearRect(0, 0, w, h);

    if (background === "white") {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, w, h);
    } else if (background === "grid") {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = "#cbd5e1"; // slate-300
      ctx.lineWidth = 1;
      const step = 24;
      ctx.beginPath();
      for (let x = 0; x <= w; x += step) {
        ctx.moveTo(x + 0.5, 0);
        ctx.lineTo(x + 0.5, h);
      }
      for (let y = 0; y <= h; y += step) {
        ctx.moveTo(0, y + 0.5);
        ctx.lineTo(w, y + 0.5);
      }
      ctx.stroke();
    } else if (background === "lined") {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = "#cbd5e1";
      ctx.lineWidth = 1;
      const step = 28;
      ctx.beginPath();
      for (let y = step; y <= h; y += step) {
        ctx.moveTo(0, y + 0.5);
        ctx.lineTo(w, y + 0.5);
      }
      ctx.stroke();
    } else if (background === "chalkboard") {
      // Dark green chalkboard.
      ctx.fillStyle = "#14532d"; // green-900
      ctx.fillRect(0, 0, w, h);
      // Subtle texture via random light dots.
      ctx.fillStyle = "rgba(220, 252, 231, 0.04)";
      for (let i = 0; i < 400; i++) {
        const x = Math.random() * w;
        const y = Math.random() * h;
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }, [background]);

  // ----- Initial setup + resize observer -----
  useEffect(() => {
    resizeCanvases();
    const wrap = wrapRef.current;
    if (!wrap) return;

    const ro = new ResizeObserver(() => resizeCanvases());
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [resizeCanvases]);

  // Repaint background whenever the mode changes.
  useEffect(() => {
    paintBackground();
  }, [paintBackground]);

  // When switching to chalkboard, default the color to white (chalk).
  useEffect(() => {
    if (background === "chalkboard" && color === PEN_COLORS[0]) {
      setColor("#ffffff");
    }
    if (background !== "chalkboard" && color === "#ffffff") {
      setColor(PEN_COLORS[0]);
    }
  }, [background, color]);

  // ----- History (undo/redo) -----
  const pushHistory = useCallback(() => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    // Drop any redo states (anything past the current index).
    historyRef.current = historyRef.current.slice(0, historyIdxRef.current + 1);
    historyRef.current.push(canvas.toDataURL("image/png"));
    // Cap the stack at 30 entries — drop the oldest.
    if (historyRef.current.length > 30) {
      historyRef.current.shift();
    } else {
      historyIdxRef.current++;
    }
    forceRerender((n) => n + 1);
  }, []);

  const undo = useCallback(() => {
    if (historyIdxRef.current <= 0) return;
    historyIdxRef.current--;
    const snapshot = historyRef.current[historyIdxRef.current];
    restoreSnapshot(snapshot);
    forceRerender((n) => n + 1);
  }, []);

  const redo = useCallback(() => {
    if (historyIdxRef.current >= historyRef.current.length - 1) return;
    historyIdxRef.current++;
    const snapshot = historyRef.current[historyIdxRef.current];
    restoreSnapshot(snapshot);
    forceRerender((n) => n + 1);
  }, []);

  const restoreSnapshot = (dataUrl: string) => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;
    ctx.clearRect(0, 0, w, h);
    if (!dataUrl) return;
    const img = new Image();
    img.onload = () => ctx.drawImage(img, 0, 0, w, h);
    img.src = dataUrl;
  };

  // Initialize history with one empty snapshot so undo never goes below 0.
  useEffect(() => {
    if (historyRef.current.length === 0) {
      const canvas = drawCanvasRef.current;
      if (canvas) {
        historyRef.current.push(canvas.toDataURL("image/png"));
        historyIdxRef.current = 0;
      }
    }
  }, []);

  // ----- Pointer handlers -----
  const getCanvasPos = (e: React.PointerEvent<HTMLCanvasElement>): [number, number] => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return [0, 0];
    const rect = canvas.getBoundingClientRect();
    return [e.clientX - rect.left, e.clientY - rect.top];
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!canEdit) return;
    if (e.button !== 0) return; // left-click only
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);

    const [x, y] = getCanvasPos(e);

    if (tool === "text") {
      setTextInputAt({ x, y });
      setTextInputValue("");
      return;
    }

    drawingRef.current = true;
    strokeBufferRef.current = [[x, y]];
    shapeStartRef.current = [x, y];

    // For freehand tools, draw an initial dot so a single tap leaves a mark.
    if (tool === "pen" || tool === "highlighter" || tool === "eraser") {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        applyStrokeStyle(ctx);
        ctx.beginPath();
        ctx.arc(x, y, width / 2, 0, Math.PI * 2);
        ctx.fillStyle = color;
        if (tool === "eraser") {
          ctx.globalCompositeOperation = "destination-out";
          ctx.fillStyle = "#000";
        }
        if (tool === "highlighter") {
          ctx.globalAlpha = 0.35;
        }
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = "source-over";
      }
    }
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!canEdit || !drawingRef.current) return;
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const [x, y] = getCanvasPos(e);

    if (tool === "pen" || tool === "highlighter" || tool === "eraser") {
      // Smooth freehand stroke using quadraticCurveTo between midpoints.
      const buf = strokeBufferRef.current;
      const prev = buf[buf.length - 1];
      const midX = (prev[0] + x) / 2;
      const midY = (prev[1] + y) / 2;

      applyStrokeStyle(ctx);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(prev[0], prev[1]);
      ctx.quadraticCurveTo(prev[0], prev[1], midX, midY);
      ctx.stroke();

      buf.push([x, y]);
    } else if (tool === "rectangle" || tool === "circle" || tool === "line") {
      // Shape preview: snapshot the canvas before the drag started, then
      // restore + redraw the shape on every move. We snapshot on the
      // first move (when shapeStartRef is set + buffer is empty for shapes).
      const start = shapeStartRef.current;
      if (!start) return;

      // Restore the snapshot from before this shape started.
      const preShapeSnapshot = historyRef.current[historyIdxRef.current];
      if (preShapeSnapshot) {
        const img = new Image();
        // Synchronous restore isn't possible with image load — but we can
        // clear + redraw on the next animation frame. For simplicity,
        // we'll clear the canvas and redraw the snapshot + the shape in
        // a single pass. Image load is async so we use a workaround:
        // we keep the in-progress shape on a separate compositing layer.
        // Simpler approach: use the bitmap from historyRef via drawImage
        // (drawImage works synchronously with ImageBitmap, but we have a
        // data URL string. We need to convert.)
        //
        // To keep this simple + correct, we'll just clear the area of the
        // shape's bounding box + redraw the shape. The rest of the canvas
        // is preserved untouched.
        const dpr = window.devicePixelRatio || 1;
        const minX = Math.min(start[0], x);
        const minY = Math.min(start[1], y);
        const maxX = Math.max(start[0], x);
        const maxY = Math.max(start[1], y);
        const pad = width + 2;

        // Clear the bounding box (+pad). Because eraser uses
        // destination-out, clearing with destination-out would also erase
        // existing strokes — so we use clearRect (which is a real clear,
        // not a destination-out composite). We then need to redraw the
        // shape on top.
        ctx.save();
        ctx.globalCompositeOperation = "copy";
        // For "copy" composite, clearRect produces transparent pixels — but
        // we want the previous content of that area. Re-fetch from the
        // history snapshot:
        //
        // To avoid an async Image load, switch to a different approach:
        // save the snapshot as ImageBitmap once at shape start.
        ctx.restore();

        // Simpler: re-load the snapshot via an Image, but synchronously
        // is impossible. So we use the offscreen approach: a temporary
        // canvas that holds the snapshot.
        if (!shapeSnapshotRef.current && preShapeSnapshot) {
          const off = document.createElement("canvas");
          off.width = canvas.width;
          off.height = canvas.height;
          const offCtx = off.getContext("2d");
          if (offCtx) {
            const img = new Image();
            img.onload = () => {
              offCtx.drawImage(img, 0, 0, canvas.width, canvas.height);
            };
            img.src = preShapeSnapshot;
            shapeSnapshotRef.current = off;
          }
        }
      }

      // Redraw the snapshot's bounding box area, then draw the live shape.
      if (shapeSnapshotRef.current) {
        const dpr = window.devicePixelRatio || 1;
        ctx.save();
        ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
        ctx.drawImage(
          shapeSnapshotRef.current,
          0,
          0,
          canvas.width / dpr,
          canvas.height / dpr
        );
        ctx.restore();
      }

      // Draw the shape preview.
      applyStrokeStyle(ctx);
      ctx.beginPath();
      if (tool === "rectangle") {
        ctx.rect(start[0], start[1], x - start[0], y - start[1]);
        ctx.stroke();
      } else if (tool === "circle") {
        const cx = (start[0] + x) / 2;
        const cy = (start[1] + y) / 2;
        const rx = Math.abs(x - start[0]) / 2;
        const ry = Math.abs(y - start[1]) / 2;
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        ctx.stroke();
      } else if (tool === "line") {
        ctx.moveTo(start[0], start[1]);
        ctx.lineTo(x, y);
        ctx.stroke();
      }
    }
  };

  const shapeSnapshotRef = useRef<HTMLCanvasElement | null>(null);

  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!canEdit || !drawingRef.current) return;
    drawingRef.current = false;
    const canvas = drawCanvasRef.current;
    if (canvas) {
      canvas.releasePointerCapture(e.pointerId);
    }
    strokeBufferRef.current = [];
    shapeStartRef.current = null;
    shapeSnapshotRef.current = null;
    // Commit the stroke to history.
    pushHistory();
  };

  const applyStrokeStyle = (ctx: CanvasRenderingContext2D) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    if (tool === "eraser") {
      ctx.globalCompositeOperation = "destination-out";
      ctx.strokeStyle = "#000";
    } else if (tool === "highlighter") {
      ctx.globalAlpha = 0.3;
      ctx.lineWidth = Math.max(width, 12);
      ctx.lineCap = "square";
    } else {
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
    }
  };

  // ----- Text tool -----
  const commitText = () => {
    if (!textInputAt || !textInputValue.trim()) {
      setTextInputAt(null);
      setTextInputValue("");
      return;
    }
    const canvas = drawCanvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.save();
        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = 1;
        ctx.fillStyle = color;
        ctx.font = `${Math.max(14, width * 4)}px ui-sans-serif, system-ui, sans-serif`;
        ctx.textBaseline = "top";
        // Multi-line: split on newlines.
        const lines = textInputValue.split("\n");
        const lineHeight = Math.max(14, width * 4) * 1.2;
        lines.forEach((line, i) => {
          ctx.fillText(line, textInputAt.x, textInputAt.y + i * lineHeight);
        });
        ctx.restore();
        pushHistory();
      }
    }
    setTextInputAt(null);
    setTextInputValue("");
  };

  // ----- Clear board -----
  const clearBoard = () => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
    pushHistory();
  };

  // ----- Export & Share -----
  const openExport = () => {
    setExportTitle(`${className} — Whiteboard ${new Date().toLocaleDateString()}`);
    setExportError(null);
    setExportSuccess(false);
    setExportOpen(true);
  };

  const handleExport = async () => {
    const bgCanvas = bgCanvasRef.current;
    const drawCanvas = drawCanvasRef.current;
    if (!bgCanvas || !drawCanvas) return;

    setExporting(true);
    setExportError(null);

    try {
      // Composite the bg + draw layers into a single canvas.
      const out = document.createElement("canvas");
      out.width = bgCanvas.width;
      out.height = bgCanvas.height;
      const outCtx = out.getContext("2d");
      if (!outCtx) throw new Error("Could not create export canvas context.");
      outCtx.drawImage(bgCanvas, 0, 0);
      outCtx.drawImage(drawCanvas, 0, 0);
      const dataUrl = out.toDataURL("image/png");

      // Build multipart/form-data.
      const blob = await (await fetch(dataUrl)).blob();
      const fd = new FormData();
      fd.append("classId", classId);
      fd.append("title", exportTitle.trim() || "Untitled whiteboard export");
      fd.append("image", blob, "whiteboard.png");

      const res = await fetch("/api/whiteboard/export", {
        method: "POST",
        body: fd,
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || `Failed (HTTP ${res.status})`);
      }
      setExportSuccess(true);
      setTimeout(() => setExportOpen(false), 1500);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : String(err));
    } finally {
      setExporting(false);
    }
  };

  // ----- Download PNG locally (no upload) -----
  const downloadPng = () => {
    const bgCanvas = bgCanvasRef.current;
    const drawCanvas = drawCanvasRef.current;
    if (!bgCanvas || !drawCanvas) return;
    const out = document.createElement("canvas");
    out.width = bgCanvas.width;
    out.height = bgCanvas.height;
    const ctx = out.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(bgCanvas, 0, 0);
    ctx.drawImage(drawCanvas, 0, 0);
    const url = out.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `whiteboard-${Date.now()}.png`;
    a.click();
  };

  const canUndo = historyIdxRef.current > 0;
  const canRedo = historyIdxRef.current < historyRef.current.length - 1;

  return (
    <div className="space-y-3">
      {/* Floating dock (top) */}
      <div className="sticky top-2 z-20 flex flex-wrap items-center gap-1.5 rounded-2xl border-2 border-slate-900 bg-[#FDFBF7] p-2 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)]">
        {/* Tool group */}
        <ToolButton icon={Pencil} label="Pen" active={tool === "pen"} onClick={() => setTool("pen")} disabled={!canEdit} />
        <ToolButton icon={Highlighter} label="Highlighter" active={tool === "highlighter"} onClick={() => setTool("highlighter")} disabled={!canEdit} />
        <ToolButton icon={Eraser} label="Eraser" active={tool === "eraser"} onClick={() => setTool("eraser")} disabled={!canEdit} />
        <ToolButton icon={Type} label="Text" active={tool === "text"} onClick={() => setTool("text")} disabled={!canEdit} />
        <ToolDivider />
        <ToolButton icon={Square} label="Rectangle" active={tool === "rectangle"} onClick={() => setTool("rectangle")} disabled={!canEdit} />
        <ToolButton icon={CircleIcon} label="Circle" active={tool === "circle"} onClick={() => setTool("circle")} disabled={!canEdit} />
        <ToolButton icon={Minus} label="Line" active={tool === "line"} onClick={() => setTool("line")} disabled={!canEdit} />

        <ToolDivider />

        {/* Color swatches */}
        <div className="flex items-center gap-1 rounded-lg border-2 border-slate-900 bg-white p-1">
          {PEN_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`Color ${c}`}
              onClick={() => setColor(c)}
              className={cn(
                "size-5 rounded-full border-2 transition-all",
                color === c
                  ? "border-slate-900 ring-2 ring-emerald-500 ring-offset-1 scale-110"
                  : "border-slate-900/50 hover:scale-105"
              )}
              style={{ background: c }}
            />
          ))}
        </div>

        {/* Width slider */}
        <div className="flex items-center gap-2 rounded-lg border-2 border-slate-900 bg-white px-3 py-1.5">
          <Brush className="size-3.5 text-slate-700" />
          <input
            type="range"
            min={0}
            max={PEN_WIDTHS.length - 1}
            step={1}
            value={Math.max(0, PEN_WIDTHS.indexOf(width))}
            onChange={(e) => setWidth(PEN_WIDTHS[Number(e.target.value)] ?? 4)}
            disabled={!canEdit}
            className="h-2 w-20 cursor-pointer accent-emerald-500"
            aria-label="Line width"
          />
          <span className="w-8 text-[10px] font-bold uppercase tracking-wider text-slate-600">
            {width}px
          </span>
        </div>

        <ToolDivider />

        {/* Background toggle */}
        <div className="flex items-center gap-1 rounded-lg border-2 border-slate-900 bg-white p-1">
          <ToolButton
            icon={PanelsTopLeft}
            label="White bg"
            size="sm"
            active={background === "white"}
            onClick={() => setBackground("white")}
            activeClass="bg-white text-slate-900 border-slate-900"
          />
          <ToolButton
            icon={Grid3x3}
            label="Grid bg"
            size="sm"
            active={background === "grid"}
            onClick={() => setBackground("grid")}
            activeClass="bg-sky-300 text-slate-900 border-slate-900"
          />
          <ToolButton
            icon={AlignJustify}
            label="Lined bg"
            size="sm"
            active={background === "lined"}
            onClick={() => setBackground("lined")}
            activeClass="bg-amber-300 text-slate-900 border-slate-900"
          />
          <ToolButton
            icon={PanelsTopLeft}
            label="Chalkboard"
            size="sm"
            active={background === "chalkboard"}
            onClick={() => setBackground("chalkboard")}
            activeClass="bg-emerald-500 text-[#FDFBF7] border-emerald-600"
          />
        </div>

        <ToolDivider />

        {/* Undo / Redo / Clear */}
        <ToolButton
          icon={Undo2}
          label="Undo"
          onClick={undo}
          disabled={!canEdit || !canUndo}
          activeClass="bg-amber-400 text-slate-900 border-amber-500"
        />
        <ToolButton
          icon={Redo2}
          label="Redo"
          onClick={redo}
          disabled={!canEdit || !canRedo}
          activeClass="bg-amber-400 text-slate-900 border-amber-500"
        />
        <ToolButton
          icon={Trash2}
          label="Clear board"
          onClick={clearBoard}
          disabled={!canEdit}
          activeClass="bg-rose-500 text-[#FDFBF7] border-rose-600"
        />

        <ToolDivider />

        {/* Download + Export */}
        <ToolButton
          icon={Download}
          label="Download PNG"
          onClick={downloadPng}
          activeClass="bg-sky-300 text-slate-900 border-slate-900"
        />
        {canEdit && (
          <Button
            type="button"
            variant="emerald"
            size="sm"
            onClick={openExport}
            className="ml-1"
          >
            <Upload className="size-4" />
            Export &amp; Share with Class
          </Button>
        )}
      </div>

      {/* Canvas wrapper */}
      <div
        ref={wrapRef}
        className="relative h-[calc(100vh-220px)] min-h-[400px] w-full overflow-hidden rounded-2xl border-[3px] border-slate-900 bg-white shadow-[6px_6px_0px_0px_rgba(15,23,42,1)]"
      >
        <canvas
          ref={bgCanvasRef}
          className="absolute inset-0"
          aria-hidden
        />
        <canvas
          ref={drawCanvasRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          className={cn(
            "absolute inset-0 touch-none",
            canEdit ? "cursor-crosshair" : "cursor-default"
          )}
          style={{ pointerEvents: canEdit ? "auto" : "none" }}
        />

        {/* Text input overlay */}
        {textInputAt && (
          <div
            className="absolute z-30"
            style={{ left: textInputAt.x, top: textInputAt.y }}
          >
            <textarea
              autoFocus
              value={textInputValue}
              onChange={(e) => setTextInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  commitText();
                }
                if (e.key === "Escape") {
                  setTextInputAt(null);
                  setTextInputValue("");
                }
              }}
              onBlur={commitText}
              rows={2}
              placeholder="Type + press Enter (Esc to cancel)"
              className="block rounded-lg border-2 border-slate-900 bg-white p-1 text-sm shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] outline-none focus:ring-2 focus:ring-emerald-500"
              style={{ color, minWidth: 180 }}
            />
          </div>
        )}

        {/* Read-only banner for students */}
        {!canEdit && (
          <div className="pointer-events-none absolute bottom-3 right-3 z-10 rounded-full border-2 border-slate-900 bg-amber-300 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]">
            Read-only view
          </div>
        )}
      </div>

      {/* Export modal */}
      <Dialog open={exportOpen} onOpenChange={setExportOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Export &amp; share with class</DialogTitle>
            <DialogDescription>
              The current board is saved as a PNG, uploaded to the
              {" "}<code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-xs">class_materials</code>
              {" "}bucket, and added as a Resource so students can download it
              immediately.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="wb-export-title">Resource title</Label>
              <Input
                id="wb-export-title"
                type="text"
                value={exportTitle}
                onChange={(e) => setExportTitle(e.target.value)}
                placeholder="e.g. Week 5 — Quadratic equations lecture"
                required
              />
            </div>

            {exportError && (
              <div
                role="alert"
                className="rounded-xl border-2 border-rose-500 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700 shadow-[2px_2px_0px_0px_rgba(244,63,94,1)]"
              >
                {exportError}
              </div>
            )}
            {exportSuccess && (
              <div
                role="status"
                className="rounded-xl border-2 border-emerald-500 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700 shadow-[2px_2px_0px_0px_rgba(16,185,129,1)]"
              >
                ✓ Saved! Students will see it in the Resources tab.
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setExportOpen(false)} disabled={exporting}>
              Cancel
            </Button>
            <Button
              variant="emerald"
              onClick={handleExport}
              disabled={exporting || !exportTitle.trim()}
            >
              {exporting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Exporting…
                </>
              ) : (
                <>
                  <Upload className="size-4" />
                  Export &amp; Share
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
