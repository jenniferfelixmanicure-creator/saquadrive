import { describe, it, expect } from "vitest";
import {
  calculateFare,
  isPeakHour,
  getSurgeMultiplier,
  getDriverCategory,
  canDriverHandleRide,
  BASE_FEE,
  MIN_FARE,
  RIDE_PRICES,
  LATE_CANCEL_FEE,
  WAIT_FEE_PER_MIN,
} from "../src/index.js";

describe("calculateFare", () => {
  it("aplica tarifa mínima para distâncias curtas", () => {
    expect(calculateFare(0.5, "basico")).toBe(MIN_FARE);
  });

  it("calcula corretamente para corrida básica de 10km sem surge", () => {
    const expected = Math.max(
      Math.round((BASE_FEE + 10 * RIDE_PRICES["basico"]) * 100) / 100,
      MIN_FARE
    );
    expect(calculateFare(10, "basico", 1.0)).toBe(expected);
  });

  it("aplica multiplicador de surge corretamente", () => {
    const semSurge = calculateFare(10, "basico", 1.0);
    const comSurge = calculateFare(10, "basico", 1.5);
    expect(comSurge).toBeGreaterThan(semSurge);
  });

  it("corrida moto é mais barata que básico na mesma distância", () => {
    expect(calculateFare(10, "moto")).toBeLessThan(calculateFare(10, "basico"));
  });

  it("corrida VIP é mais cara que básico na mesma distância", () => {
    expect(calculateFare(10, "vip")).toBeGreaterThan(calculateFare(10, "basico"));
  });

  it("tipo desconhecido usa tarifa de básico como fallback", () => {
    expect(calculateFare(10, "desconhecido")).toBe(calculateFare(10, "basico"));
  });
});

describe("isPeakHour", () => {
  it("7h é horário de pico", () => expect(isPeakHour(7)).toBe(true));
  it("9h é horário de pico", () => expect(isPeakHour(9)).toBe(true));
  it("17h é horário de pico", () => expect(isPeakHour(17)).toBe(true));
  it("19h é horário de pico", () => expect(isPeakHour(19)).toBe(true));
  it("12h não é horário de pico", () => expect(isPeakHour(12)).toBe(false));
  it("3h não é horário de pico", () => expect(isPeakHour(3)).toBe(false));
});

describe("getSurgeMultiplier", () => {
  it("retorna 1.5 no horário de pico", () => expect(getSurgeMultiplier(8)).toBe(1.5));
  it("retorna 1.0 fora do pico", () => expect(getSurgeMultiplier(14)).toBe(1.0));
});

describe("getDriverCategory", () => {
  it("carro 2020+ é VIP", () => expect(getDriverCategory(2020)).toBe("vip"));
  it("carro 2015 é intermediário", () => expect(getDriverCategory(2015)).toBe("intermediario"));
  it("carro 2005 é básico", () => expect(getDriverCategory(2005)).toBe("basico"));
});

describe("canDriverHandleRide", () => {
  it("moto só atende corrida moto", () => {
    expect(canDriverHandleRide("moto", 2022, "moto")).toBe(true);
    expect(canDriverHandleRide("moto", 2022, "basico")).toBe(false);
  });

  it("carro VIP atende todos os tipos", () => {
    expect(canDriverHandleRide("car", 2022, "basico")).toBe(true);
    expect(canDriverHandleRide("car", 2022, "intermediario")).toBe(true);
    expect(canDriverHandleRide("car", 2022, "vip")).toBe(true);
  });

  it("carro intermediário não atende VIP", () => {
    expect(canDriverHandleRide("car", 2015, "vip")).toBe(false);
    expect(canDriverHandleRide("car", 2015, "basico")).toBe(true);
  });

  it("carro básico só atende básico", () => {
    expect(canDriverHandleRide("car", 2005, "basico")).toBe(true);
    expect(canDriverHandleRide("car", 2005, "intermediario")).toBe(false);
  });
});

describe("constantes de negócio", () => {
  it("taxa de cancelamento tardio é R$ 7,50", () => expect(LATE_CANCEL_FEE).toBe(7.50));
  it("taxa de espera por minuto é R$ 0,30", () => expect(WAIT_FEE_PER_MIN).toBe(0.30));
  it("tarifa mínima é R$ 10", () => expect(MIN_FARE).toBe(10));
});
