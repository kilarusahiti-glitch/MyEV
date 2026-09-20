# ⚡ MyEV — Smart EV Charging & Localized Grid Management

**MyEV** is a smart EV charging management platform designed for residential and commercial charging clusters. It dynamically coordinates multiple EVs while considering **building demand, grid capacity, battery levels, departure requirements, charger limits, and renewable energy availability**.

> **Charge the right EV, at the right power, at the right time — without exceeding the site's electrical limit.**

## 🚗 The Problem

When multiple EVs charge simultaneously in apartments, workplaces, or commercial facilities, uncontrolled charging can create high peak demand and overload the site's available electrical capacity.

Simply dividing power equally is also inefficient because every EV has different:

- Battery level
- Target SOC
- Departure time
- Charging capability
- Driver requirements

MyEV solves this by intelligently coordinating the available power between connected EVs.

## 💡 Our Solution

MyEV continuously monitors the energy system and follows a five-stage optimization process:

```text
Constraints
    ↓
Feasibility
    ↓
Priority
    ↓
Power Allocation
    ↓
Validation
```

The system first calculates how much power is safely available for EV charging:

```text
Available EV Power =
Grid Limit - Building Demand + Solar Generation - Safety Reserve
```

It then determines which EVs need power most urgently and distributes the available capacity without violating grid, vehicle, or charger limits.

## ✨ Key Features

- ⚡ Dynamic EV power allocation
- 🔋 SOC and charging-status monitoring
- ⏰ Departure-aware charging
- ☀️ Renewable-aware charging using solar availability
- 🏢 Building and grid demand monitoring
- 🔌 Charger health and fault handling
- 📊 Real-time admin dashboard
- 📱 EV owner mobile application
- 🔮 Vehicle usage and energy forecasting
- 🚨 Alerts and charging explanations
- 🧪 Digital Twin / Virtual Energy Testbed
- 💰 Charging history and billing
- 🔥 Charge Faster functionality
- 🌱 FAST, CHEAPEST and GREENEST charging preferences

## ☀️ Renewable-Aware Charging

Solar generation is not just displayed on the dashboard — it is an input to the charging decision.

```text
Grid Import = Building Demand + EV Load - Solar Generation
```

When local solar generation increases, MyEV can identify additional safe charging opportunities. When sufficient charging flexibility exists, GREENEST mode can favor periods with better renewable-energy availability.

## 🧪 Virtual Energy Testbed

The prototype uses a **stateful Virtual Energy Testbed** to simulate:

- Building demand
- Solar generation
- EV battery levels
- Charger power and status
- Grid conditions

This creates a closed feedback loop:

```text
Virtual Sensors
      ↓
System State
      ↓
Optimization Engine
      ↓
Charging Decision
      ↓
EV / Grid State Changes
      ↓
New Sensor Data
```

It allows us to safely test scenarios such as **Building Peak, Solar Peak, EV Rush, and Charger Fault** without requiring physical EV charging infrastructure.

In a real deployment, these virtual adapters can be replaced with data from smart meters, charging infrastructure, solar inverters, and other energy systems.

## 🧠 Smart Charging Example

Suppose:

```text
Grid Limit       = 100 kW
Building Demand  = 65 kW
Solar Generation = 10 kW
Safety Reserve   = 5 kW
```

Then:

```text
Available EV Power = 100 - 65 + 10 - 5
                   = 40 kW
```

If connected EVs request more than 40 kW, MyEV prioritizes them according to their charging requirements and distributes only the safely available **40 kW**.

## 🏗️ Architecture

```text
        EV Owner Mobile App
                 │
              Firebase
                 │
                 ▼
        ┌─────────────────┐
        │ FastAPI Backend │
        │                 │
        │ Forecasting     │
        │ Constraints     │
        │ Feasibility     │
        │ Priority        │
        │ Allocation      │
        │ Validation      │
        └────────┬────────┘
                 │
          REST / WebSocket
                 │
        ┌────────┴────────┐
        ▼                 ▼
 Admin Dashboard    Virtual Energy
                    Testbed
```

## 🛠️ Tech Stack

**Frontend**
- React
- Vite

**Mobile**
- React Native
- Expo
- TypeScript
- Zustand

**Backend**
- Python
- FastAPI
- REST API
- WebSockets

**Cloud & Persistence**
- Firebase Authentication
- Cloud Firestore

## 🚀 Running the Project

### Backend

```bash
cd backend
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --env-file .env
```

FastAPI documentation:

```text
http://localhost:8000/docs
```

### Web Dashboard

```bash
npm install
npm run dev
```

### Mobile App

From the mobile project directory:

```bash
npm install
npx expo start
```

## 🌍 Future Scope

MyEV can be extended to integrate with real-world:

- Smart meters
- OCPP-compatible EV chargers
- Solar inverter APIs
- Building Energy Management Systems
- Tariff and weather APIs
- Battery Energy Storage Systems
- Demand-response programs

## 🎯 Vision

MyEV treats the **grid, building, renewable generation, chargers, and EVs as one coordinated energy system**.

Instead of asking only:

> *“Can this EV charge?”*

MyEV asks:

> **“How much should it charge, when should it charge, and how can we do it without stressing the grid?”**

---

### ⚡ MyEV
**Charge smarter. Protect the grid. Use renewable energy better.**
