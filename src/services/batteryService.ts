export interface BatteryInfo {
  level: number; // 0 - 100
  charging: boolean;
}

export class BatteryService {
  private static listenerRegistered = false;

  public static async getBatteryInfo(): Promise<BatteryInfo | null> {
    if (typeof navigator !== 'undefined' && 'getBattery' in navigator) {
      try {
        const battery: any = await (navigator as any).getBattery();
        return {
          level: Math.round(battery.level * 100),
          charging: battery.charging,
        };
      } catch (err) {
        console.warn('Battery API call failed:', err);
      }
    }
    return null;
  }

  public static subscribeToBattery(callback: (info: BatteryInfo) => void): () => void {
    let active = true;

    if (typeof navigator !== 'undefined' && 'getBattery' in navigator) {
      (navigator as any).getBattery().then((battery: any) => {
        if (!active) return;

        const update = () => {
          callback({
            level: Math.round(battery.level * 100),
            charging: battery.charging,
          });
        };

        update();

        battery.addEventListener('levelchange', update);
        battery.addEventListener('chargingchange', update);
      }).catch(() => {});
    }

    return () => {
      active = false;
    };
  }
}
