import React, { useState, useEffect } from 'react';
import { useSystem } from '@ohif/core';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Slider,
} from '@ohif/ui-next';
import { Enums } from '@cornerstonejs/core';
import { VolumeViewport } from '@cornerstonejs/core';

const BLEND_MODE_LABELS = [
  { value: 'mip', label: 'MIP' },
  { value: 'minip', label: 'MinIP' },
  { value: 'avg', label: 'AvgIP' },
];

function getStringBlendMode(csBlendMode: Enums.BlendModes): string {
  switch (csBlendMode) {
    case Enums.BlendModes.MAXIMUM_INTENSITY_BLEND:
      return 'mip';
    case Enums.BlendModes.MINIMUM_INTENSITY_BLEND:
      return 'minip';
    case Enums.BlendModes.AVERAGE_INTENSITY_BLEND:
      return 'avg';
    default:
      return 'mip';
  }
}

interface IntensityProjectionControlsProps {
  viewportId: string;
  minThickness?: number;
  maxThickness?: number;
  stepThickness?: number;
  disabled?: boolean;
}

export function IntensityProjectionControls({
  viewportId,
  minThickness = 0.1,
  maxThickness = 20,
  stepThickness = 0.1,
  disabled = false,
}: IntensityProjectionControlsProps) {
  const [blendMode, setBlendMode] = useState<string>('mip');
  const [slabThickness, setSlabThickness] = useState<number>(0.1);

  const { commandsManager, servicesManager } = useSystem();
  const { cornerstoneViewportService } = servicesManager.services;

  // Sync state from the active viewport when it changes
  useEffect(() => {
    const viewport = cornerstoneViewportService.getCornerstoneViewport(viewportId);
    if (!viewport || !(viewport instanceof VolumeViewport)) return;

    try {
      const csBlendMode = viewport.getBlendMode();
      // Only sync if it's a known intensity blend mode (not COMPOSITE)
      if (
        csBlendMode === Enums.BlendModes.MAXIMUM_INTENSITY_BLEND ||
        csBlendMode === Enums.BlendModes.MINIMUM_INTENSITY_BLEND ||
        csBlendMode === Enums.BlendModes.AVERAGE_INTENSITY_BLEND
      ) {
        setBlendMode(getStringBlendMode(csBlendMode));
      }
      const slab = viewport.getSlabThickness?.();
      if (slab !== undefined && slab >= minThickness) {
        setSlabThickness(slab);
      }
    } catch {
      // ignore errors from uninitialized viewport
    }
  }, [viewportId, cornerstoneViewportService, minThickness]);

  const handleBlendModeChange = (value: string) => {
    setBlendMode(value);
    commandsManager.run('setIntensityProjection', { blendMode: value, slabThickness });
  };

  const handleSlabChange = ([value]: number[]) => {
    setSlabThickness(value);
    commandsManager.run('setIntensityProjection', { blendMode, slabThickness: value });
  };

  return (
    <div className="flex items-center gap-2 px-1">
      <Select
        value={blendMode}
        onValueChange={handleBlendModeChange}
        disabled={disabled}
      >
        <SelectTrigger className="w-20 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {BLEND_MODE_LABELS.map(({ value, label }) => (
            <SelectItem
              key={value}
              value={value}
              className="text-xs"
            >
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Slider
        className="w-24"
        min={minThickness}
        max={maxThickness}
        step={stepThickness}
        value={[slabThickness]}
        onValueChange={handleSlabChange}
        disabled={disabled}
      />
      <span className="text-muted-foreground min-w-[3.5rem] text-xs">
        {slabThickness.toFixed(1)} mm
      </span>
    </div>
  );
}
