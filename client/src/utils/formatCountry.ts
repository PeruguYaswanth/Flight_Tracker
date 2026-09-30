/**
 * Country for display. The provider sends ISO codes ("BR") while the local
 * airport table stores names ("India"); codes are shown as the country name.
 */
export function formatCountry(country?: string | null): string | null {
  if (!country) return null;
  if (/^[A-Za-z]{2}$/.test(country)) {
    try {
      return new Intl.DisplayNames(['en'], { type: 'region' }).of(country.toUpperCase()) || country;
    } catch {
      return country;
    }
  }
  return country;
}
