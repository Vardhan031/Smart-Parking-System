import api from "./api";

interface ListLotsParams {
  lat?: number;
  lng?: number;
}

interface HistoryParams {
  page?: number;
  limit?: number;
}

export const parkingService = {
  // Public
  listLots: (params?: ListLotsParams) =>
    api.get("/user/lots", { params }),
  getLotDetail: (id: string) => api.get(`/user/lots/${id}`),

  // Protected — sessions
  getActiveSession: () => api.get("/user/sessions/active"),
  getSessionHistory: (params?: HistoryParams) =>
    api.get("/user/sessions/history", { params }),

  // Protected — vehicles
  linkVehicle: (plate: string) =>
    api.post("/user/vehicles", { plateNumber: plate }),
  unlinkVehicle: (plate: string) => api.delete(`/user/vehicles/${plate}`),

  // FCM token
  registerFcmToken: (fcmToken: string) =>
    api.post("/user/fcm-token", { fcmToken }),
};
