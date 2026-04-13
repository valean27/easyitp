import api from './axiosInstance';

export const createUser = (email: string, password: string): Promise<void> =>
  api.post('/api/admin/create-user', { email, password }).then(() => undefined);
