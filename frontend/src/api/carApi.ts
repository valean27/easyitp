import api from './axiosInstance';

export interface CarMake {
  id: number;
  name: string;
}

export interface CarModel {
  id: number;
  name: string;
  makeId: number;
}

export const getMakes = (): Promise<CarMake[]> =>
  api.get('/api/cars/makes').then((r) => r.data);

export const createMake = (name: string): Promise<CarMake> =>
  api.post('/api/cars/makes', { name }).then((r) => r.data);

export const getModels = (makeId: number): Promise<CarModel[]> =>
  api.get('/api/cars/models', { params: { makeId } }).then((r) => r.data);

export const createModel = (name: string, makeId: number): Promise<CarModel> =>
  api.post('/api/cars/models', { name, makeId }).then((r) => r.data);
