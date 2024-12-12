# Dockerfile

# Sử dụng Node.js phiên bản hiện tại
FROM node:current-alpine AS build

# Tạo thư mục làm việc trong container
WORKDIR /app

# Sao chép package.json và package-lock.json vào container
COPY package.json package-lock.json ./

# Cài đặt dependencies
RUN npm install --frozen-lockfile

# Sao chép mã nguồn vào container
COPY . .

# Build ứng dụng ReactJS
RUN npm run build

# Sử dụng Node.js để serve ứng dụng
FROM node:current-alpine

# Tạo thư mục làm việc
WORKDIR /app

# Cài đặt một dependency nhẹ để serve file tĩnh (serve-static)
RUN npm install -g serve

# Sao chép file build từ giai đoạn trước
COPY --from=build /app/dist /app/dist

# Expose port 3001
EXPOSE 3001

# Command để serve file build ReactJS
CMD ["serve", "-s", "build", "-l", "3001"]
