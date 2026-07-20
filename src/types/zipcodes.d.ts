// Minimal type declarations for the `zipcodes` package (MIT, ships US zip
// centroid data: zip, lat/lng, city, state). No official types are published.
declare module 'zipcodes' {
  export interface ZipInfo {
    zip: string
    latitude: number | null
    longitude: number | null
    city: string
    state: string
    country: string
  }
  export function lookup(zip: string | number): ZipInfo | undefined
  export function radius(zip: string | number, miles: number): string[]
  export function distance(zipA: string | number, zipB: string | number): number | null
  export const codes: Record<string, ZipInfo>
}
