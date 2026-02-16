FROM node:22-alpine

WORKDIR /app

# Copiar package.json y .npmrc
COPY package*.json .npmrc ./

# Limpiar cache y establecer registry
RUN npm cache clean --force
RUN npm set registry https://registry.npmjs.org/

# Install dependencies con flags optimizados
RUN npm install --legacy-peer-deps

# Copiar el resto del código
COPY . .

# Build - pasar secretos como build args si es necesario
ARG STRIPE_SECRET_KEY
ARG PUBLIC_SUPABASE_URL
ARG PUBLIC_SUPABASE_ANON_KEY
ARG BREVO_API_KEY

# Build la app
RUN npm run build

# Exponer puertos
EXPOSE 4321

# Escuchar en todas las interfaces (necesario para Docker + reverse proxy)
ENV HOST=0.0.0.0
ENV PORT=4321

# Start con manejo de señales
STOPSIGNAL SIGTERM
CMD ["node", "--no-warnings=ExperimentalWarning", "dist/server/entry.mjs"]
