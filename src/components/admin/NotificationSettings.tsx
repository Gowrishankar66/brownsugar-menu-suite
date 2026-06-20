import { useEffect, useState } from "react";
import { Bell, Volume2, VolumeX } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  loadNotifySettings,
  saveNotifySettings,
  playNotify,
  stopRinging,
  startRinging,
  type NotifySettings,
} from "@/lib/notify-sound";

export function NotificationSettings() {
  const [s, setS] = useState<NotifySettings>({ enabled: true, volume: 0.7, mode: "continuous" });

  useEffect(() => { setS(loadNotifySettings()); }, []);

  function update(next: NotifySettings) {
    setS(next);
    saveNotifySettings(next);
    if (!next.enabled || next.volume <= 0) stopRinging();
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="rounded-full"
          aria-label="Notification settings"
          title={s.enabled ? "Notification sound on" : "Notification sound off"}
        >
          {s.enabled && s.volume > 0 ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 rounded-2xl">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Order alerts</p>
              <p className="text-[11px] text-muted-foreground">Telephone ring on new orders</p>
            </div>
            <Switch checked={s.enabled} onCheckedChange={(v) => update({ ...s, enabled: v })} />
          </div>

          <div>
            <p className="mb-1 text-xs text-muted-foreground">Mode</p>
            <Select value={s.mode} onValueChange={(v) => update({ ...s, mode: v as NotifySettings["mode"] })} disabled={!s.enabled}>
              <SelectTrigger className="h-9 rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="once">Ring once</SelectItem>
                <SelectItem value="continuous">Ring until accepted</SelectItem>
              </SelectContent>
            </Select>
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

          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="flex-1 rounded-full"
              onClick={() => playNotify("new", s)}
              disabled={!s.enabled}
            >
              <Bell className="mr-1 h-3 w-3" /> Test
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="flex-1 rounded-full"
              onClick={() => { startRinging(s); window.setTimeout(stopRinging, 5000); }}
              disabled={!s.enabled}
            >
              Ring 5s
            </Button>
          </div>
          <Button type="button" size="sm" variant="ghost" className="w-full rounded-full text-xs" onClick={stopRinging}>
            Stop ringing
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
