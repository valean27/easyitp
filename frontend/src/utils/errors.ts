import axios from 'axios';

// Mesajul trimis de server ({"message": ...}) sau unul implicit
export function apiMessage(err: unknown, fallback: string): string {
  const message = axios.isAxiosError(err) ? (err.response?.data as { message?: string } | undefined)?.message : undefined;
  return message || fallback;
}
