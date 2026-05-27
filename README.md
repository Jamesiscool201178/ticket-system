# Ticket System

A simple ticket system website with an Express backend and a React frontend.

## Setup

1. Install backend dependencies:
   ```bash
   npm install
   ```
2. Install frontend dependencies:
   ```bash
   npm run install-client
   ```
3. Run the app in development:
   ```bash
   npm run dev
   ```
4. Build the frontend and start the backend for production:
   ```bash
   cd client && npm run build
   cd ..
   npm start
   ```

## API

- `GET /api/tickets` — list all tickets
- `POST /api/tickets` — create a ticket with `{ title, description }`

## Public access

To run the frontend so it is reachable from other devices on your local network, use:

```bash
npm run dev:public
```

Then open the site at `http://<your-machine-ip>:5173` from another device.

To run the production-ready backend and frontend together:

```bash
cd client && npm run build
cd ..
npm start
```

To deploy on Render with a proper URL, use these settings:

- Build Command: `npm run build`
- Start Command: `npm start`
- Environment: `Node`

This repo also includes `render.yaml` for Render’s infrastructure-as-code support.

If you want the site to be accessible from the internet, deploy the project to a hosting platform such as Render, Railway, Fly, or a VPS.

## Notes

- Tickets are stored in `tickets.json`
- The React app is in `client/`
