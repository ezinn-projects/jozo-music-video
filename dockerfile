# Base image cho build
FROM node:current-alpine AS build

# Thư mục làm việc trong container
WORKDIR /app

# Sao chép các file cần thiết
COPY package.json package-lock.json ./

# Cài đặt dependencies
RUN npm install --frozen-lockfile

# Sao chép toàn bộ mã nguồn vào container
COPY . .

# Build ứng dụng Vite
RUN npm run build

# Base image cho chạy ứng dụng
FROM node:current-alpine

# Thư mục làm việc
WORKDIR /app

# Sao chép file build và package.json từ giai đoạn build
COPY --from=build /app/dist /app/dist
COPY --from=build /app/package.json /app/package.json

# Cài đặt production dependencies (không cần devDependencies)
RUN npm install --production

# Mở cổng 4173 (Vite Preview chạy mặc định trên port này)
EXPOSE 3001

# Chạy ứng dụng Vite bằng npm preview
CMD ["npm", "run", "preview"]
