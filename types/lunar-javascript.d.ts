declare module "lunar-javascript" {
  export interface Solar {
    getYear(): number;
    getMonth(): number;
    getDay(): number;
    getLunar(): LunarInstance;
  }

  export interface LunarInstance {
    getSolar(): Solar;
    getXiu(): string;
    getXiuLuck(): string;
    getXiuSong(): string;
    getZheng(): string;
    getAnimal(): string;
    getGong(): string;
  }

  export const Solar: {
    fromYmdHms(
      year: number,
      month: number,
      day: number,
      hour: number,
      minute: number,
      second: number,
    ): Solar;
  };

  export const Lunar: {
    fromYmdHms(
      year: number,
      month: number,
      day: number,
      hour: number,
      minute: number,
      second: number,
    ): LunarInstance;
  };
}
