import api from "./api";

export const walletService = {
  getWallet: () => api.get("/user/wallet"),
  topUp: (amount: number) => api.post("/user/wallet/topup", { amount }),
  verifyPayment: (orderId: string, paymentId?: string) =>
    api.post("/user/wallet/verify-payment", { orderId, paymentId }),
};
