import { useEffect, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import {
  loadNotifySettings,
  saveNotifySettings,
  playNotify,
  type NotifySettings,
} from "@/lib/notify-sound";

/** Notification on/off + volume control. Persists to localStorage. */
export function NotificationSettings() {
  const [s, setS] = useState<NotifySettings>({ enabled: true, volume: 0.6 });

  useEffect(() => { setS(loadNotifySettings()); }, []);

  function update(next: NotifySettings) {
    setS(next);
    saveNotifySettings(next);
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="rounded-full"
          title={s.enabled ? "Notification sound on" : "Notification sound off"}
        >
          {s.enabled && s.volume > 0 ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 rounded-2xl">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Order alerts</p>
              <p className="text-[11px] text-muted-foreground">Plays a chime on new orders</p>
            </div>
            <Switch checked={s.enabled} onCheckedChange={(v) => update({ ...s, enabled: v })} />
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Volume</p>
              <p className="font-ui text-xs">{Math.round(s.volume * 100)}%</p>
            </div>
            <Slider
              value={[s.volume * 100]}
              min={0}
              max={100}
              step={5}
              disabled={!s.enabled}
              onValueChange={([v]) => update({ ...s, volume: v / 100 })}
            />
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="w-full rounded-full"
            onClick={() => playNotify("new", s)}
            disabled={!s.enabled}
          >
            Test sound
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
