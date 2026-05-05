declare module "lunar-javascript" {
  export interface Solar {
    getYear(): number;
    getMonth(): number;
    getDay(): number;
  }

  export interface LunarInstance {
    getSolar(): Solar;
  }

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
