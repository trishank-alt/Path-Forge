"use client";

import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { LearnerProfile } from "@/lib/contracts";
import {
  buildCareerMapGraph,
  CareerMapGraph,
  MapNodeViewModel,
  MapEdgeViewModel,
} from "./map-layout-adapter";
import { MapControls } from "./MapControls";
import { MapLegend } from "./MapLegend";
import { NodeDetailsPanel } from "./NodeDetailsPanel";
import { Sparkles } from "lucide-react";

interface CareerMapProps {
  profile: LearnerProfile | null;
  onAskAboutSkill?: (skillName: string) => void;
  className?: string;
}

export function CareerMap({ profile, onAskAboutSkill, className = "" }: CareerMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Pan and Zoom State
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Interactive Selection and Hover State
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  // Build deterministic graph from profile
  const graph: CareerMapGraph = useMemo(() => {
    return buildCareerMapGraph(profile);
  }, [profile]);

  const nodesMap = useMemo(() => {
    const map = new Map<string, MapNodeViewModel>();
    for (const node of graph.nodes) {
      map.set(node.id, node);
    }
    return map;
  }, [graph.nodes]);

  const selectedNode = selectedNodeId ? nodesMap.get(selectedNodeId) || null : null;

  // Center on current position or reset view
  const centerOnPosition = useCallback(() => {
    const current = graph.currentPositionNodeId ? nodesMap.get(graph.currentPositionNodeId) : null;
    if (current) {
      setTransform({ x: -current.x, y: -current.y, scale: 1 });
    } else {
      setTransform({ x: 0, y: 0, scale: 1 });
    }
  }, [graph.currentPositionNodeId, nodesMap]);

  const resetView = useCallback(() => {
    setTransform({ x: 0, y: 0, scale: 0.9 });
    setSelectedNodeId(null);
  }, []);

  // Initialize or center once graph nodes become available
  useEffect(() => {
    if (graph.nodes.length > 0) {
      centerOnPosition();
    }
  }, [graph.currentPositionNodeId, centerOnPosition]);

  // Zoom helpers
  const handleZoom = useCallback((delta: number) => {
    setTransform((prev) => {
      const nextScale = Math.min(2.5, Math.max(0.4, prev.scale + delta));
      return { ...prev, scale: nextScale };
    });
  }, []);

  // Native non-passive wheel listener to strictly prevent page scrolling when zooming inside the map
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const zoomFactor = e.deltaY < 0 ? 0.12 : -0.12;
      handleZoom(zoomFactor);
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", onWheel);
    };
  }, [handleZoom]);

  // Mouse drag pan
  const handleMouseDown = (e: React.MouseEvent) => {
    // Only pan if left-click directly on svg background
    if (e.button !== 0) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - transform.x, y: e.clientY - transform.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setTransform((prev) => ({
      ...prev,
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    }));
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Touch handlers for mobile pan & pinch
  const touchStartRef = useRef<{ x: number; y: number; dist?: number }>({ x: 0, y: 0 });

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      const t = e.touches[0];
      touchStartRef.current = { x: t.clientX - transform.x, y: t.clientY - transform.y };
      setIsDragging(true);
    } else if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      touchStartRef.current.dist = Math.hypot(dx, dy);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 1 && isDragging) {
      const t = e.touches[0];
      setTransform((prev) => ({
        ...prev,
        x: t.clientX - touchStartRef.current.x,
        y: t.clientY - touchStartRef.current.y,
      }));
    } else if (e.touches.length === 2 && touchStartRef.current.dist) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const newDist = Math.hypot(dx, dy);
      const diff = (newDist - touchStartRef.current.dist) * 0.005;
      touchStartRef.current.dist = newDist;
      handleZoom(diff);
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  // Connected nodes highlighting logic
  const activeFocusNodeId = hoveredNodeId || selectedNodeId;
  const connectedToFocus = useMemo(() => {
    if (!activeFocusNodeId) return new Set<string>();
    const node = nodesMap.get(activeFocusNodeId);
    if (!node) return new Set<string>();
    return new Set([activeFocusNodeId, ...node.connectedNodeIds]);
  }, [activeFocusNodeId, nodesMap]);

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full min-h-[420px] rounded-2xl glass-panel border border-slate-800/80 overflow-hidden select-none touch-none overscroll-contain ${className}`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{
        cursor: isDragging ? "grabbing" : "grab",
        touchAction: "none",
        overscrollBehavior: "contain",
      }}
    >
      {/* Background Grid Pattern */}
      <div
        className="absolute inset-0 opacity-20 pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, rgba(56, 189, 248, 0.4) 1px, transparent 0)`,
          backgroundSize: "32px 32px",
          transform: `translate(${transform.x % 32}px, ${transform.y % 32}px)`,
        }}
      />

      {/* Discovery Banner (when no active phase) */}
      {graph.discoveryMode && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
          <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-900/90 border border-cyan-500/30 text-cyan-300 text-xs shadow-lg backdrop-blur-md">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span className="font-semibold">Discovery Mode:</span>
            <span className="text-slate-300">Your terrain is taking shape through conversation</span>
          </div>
        </div>
      )}

      {/* Interactive Controls & Legend */}
      <MapLegend />
      <MapControls
        onZoomIn={() => handleZoom(0.15)}
        onZoomOut={() => handleZoom(-0.15)}
        onCenterOnMe={centerOnPosition}
        onResetView={resetView}
      />

      {/* SVG Canvas */}
      <svg className="w-full h-full" style={{ overflow: "visible" }}>
        <defs>
          {/* Subtle Glow Filters */}
          <filter id="glow-cyan" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#38bdf8" floodOpacity="0.5" />
          </filter>
          <filter id="glow-indigo" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#818cf8" floodOpacity="0.4" />
          </filter>
          <filter id="glow-emerald" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#10b981" floodOpacity="0.4" />
          </filter>
        </defs>

        {/* Scaled & Translated Layer Centered in Container */}
        <g
          transform={`translate(${containerRef.current ? containerRef.current.clientWidth / 2 + transform.x : transform.x}, ${
            containerRef.current ? containerRef.current.clientHeight / 2 + transform.y : transform.y
          }) scale(${transform.scale})`}
        >
          {/* 1. Render Edges */}
          {graph.edges.map((edge) => {
            const source = nodesMap.get(edge.source);
            const target = nodesMap.get(edge.target);
            if (!source || !target) return null;

            const isHighlighted =
              connectedToFocus.has(edge.source) && connectedToFocus.has(edge.target);
            const isFaded = activeFocusNodeId && !isHighlighted;

            const strokeColor =
              edge.relationship === "developing"
                ? "#38bdf8"
                : edge.relationship === "prerequisite"
                ? "#818cf8"
                : "#64748b";

            return (
              <g key={edge.id}>
                <line
                  x1={source.x}
                  y1={source.y}
                  x2={target.x}
                  y2={target.y}
                  stroke={strokeColor}
                  strokeWidth={isHighlighted ? 2.5 : 1.2}
                  strokeDasharray={edge.relationship === "prerequisite" ? "4,4" : undefined}
                  opacity={isHighlighted ? 0.9 : isFaded ? 0.15 : 0.4}
                  className="transition-all duration-200"
                />
              </g>
            );
          })}

          {/* 2. Render Nodes */}
          {graph.nodes.map((node) => {
            const isSelected = selectedNodeId === node.id;
            const isHovered = hoveredNodeId === node.id;
            const isHighlighted = connectedToFocus.has(node.id);
            const isFaded = activeFocusNodeId && !isHighlighted && !isSelected;

            // Visual attributes based on qualitative status
            let fillColor = "#1e293b";
            let strokeColor = "#475569";
            let textColor = "#e2e8f0";
            let filter: string | undefined = undefined;

            if (node.status === "current") {
              fillColor = "#082f49";
              strokeColor = "#38bdf8";
              textColor = "#38bdf8";
              filter = "url(#glow-cyan)";
            } else if (node.status === "developing") {
              fillColor = "#1e1b4b";
              strokeColor = "#818cf8";
              textColor = "#c7d2fe";
              filter = "url(#glow-indigo)";
            } else if (node.status === "demonstrated") {
              fillColor = "#064e3b";
              strokeColor = "#10b981";
              textColor = "#6ee7b7";
              filter = "url(#glow-emerald)";
            } else if (node.status === "explored") {
              fillColor = "#451a03";
              strokeColor = "#d97706";
              textColor = "#fcd34d";
            } else if (node.status === "emerging") {
              fillColor = "#0f172a";
              strokeColor = "#64748b";
              textColor = "#94a3b8";
            }

            const currentRadius = isHovered || isSelected ? node.radius * 1.15 : node.radius;

            return (
              <g
                key={node.id}
                transform={`translate(${node.x}, ${node.y})`}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedNodeId(node.id);
                }}
                onMouseEnter={() => setHoveredNodeId(node.id)}
                onMouseLeave={() => setHoveredNodeId(null)}
                className="cursor-pointer transition-all duration-200"
                opacity={isFaded ? 0.3 : 1}
              >
                {/* Concentric Pulse for Current Position */}
                {node.status === "current" && (
                  <circle
                    r={currentRadius + 10}
                    fill="none"
                    stroke="#38bdf8"
                    strokeWidth="1.5"
                    strokeDasharray="4,4"
                    opacity="0.6"
                    className="animate-spin"
                    style={{ animationDuration: "12s" }}
                  />
                )}

                {/* Main Node Circle */}
                <circle
                  r={currentRadius}
                  fill={fillColor}
                  stroke={isSelected ? "#38bdf8" : strokeColor}
                  strokeWidth={isSelected ? 3 : node.status === "emerging" ? 1.5 : 2}
                  strokeDasharray={node.status === "emerging" ? "3,3" : undefined}
                  filter={filter}
                />

                {/* Inner Core for Demonstrated & Developing */}
                {node.status === "demonstrated" && (
                  <circle r={node.radius * 0.45} fill="#10b981" opacity="0.9" />
                )}
                {node.status === "developing" && (
                  <circle r={node.radius * 0.4} fill="#818cf8" opacity="0.85" />
                )}
                {node.status === "current" && (
                  <circle r={node.radius * 0.35} fill="#38bdf8" className="animate-pulse" />
                )}

                {/* Node Label */}
                <text
                  y={currentRadius + 14}
                  textAnchor="middle"
                  fill={isSelected ? "#38bdf8" : textColor}
                  fontSize={node.status === "current" ? "12px" : "11px"}
                  fontWeight={node.status === "current" || isSelected ? "700" : "600"}
                  className="pointer-events-none select-none drop-shadow-md"
                >
                  {node.label}
                </text>

                {/* Evidence Count Pill (if evidence exists) */}
                {node.evidenceCount > 0 && node.status !== "current" && (
                  <g transform={`translate(${currentRadius * 0.7}, ${-currentRadius * 0.7})`}>
                    <circle r="7" fill="#0284c7" />
                    <text
                      y="2.5"
                      textAnchor="middle"
                      fill="#ffffff"
                      fontSize="8px"
                      fontWeight="bold"
                    >
                      {node.evidenceCount}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </g>
      </svg>

      {/* Contextual Node Details Modal / Panel */}
      {selectedNode && (
        <NodeDetailsPanel
          node={selectedNode}
          allNodesMap={nodesMap}
          onClose={() => setSelectedNodeId(null)}
          onAskAboutNode={(label) => onAskAboutSkill?.(label)}
          onSelectConnectedNode={(connId) => setSelectedNodeId(connId)}
        />
      )}
    </div>
  );
}
