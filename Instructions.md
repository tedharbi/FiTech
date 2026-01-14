# How to Deploy Locally with Docker
## Prepare Your Project
### Ensure your entry file is correct.
If your main file is server.js, update package.json:
```
{
  "scripts": {
    "start": "nodemon server.js"
  }
}
```

### Create a .env file in your project root:
```
CLOUDINARY_CLOUD_NAME=mycloud
CLOUDINARY_API_KEY=123456789
CLOUDINARY_API_SECRET=abcdef123456

DATABASE_URL=postgres://user:password@dbhost:5432/mydb

GROQ_API_URL=https://api.groq.com/v1/chat/completions
GROQ_API_KEY=your_groq_key

DISEASE_INFO_URL=https://plantvillage.com/onions
DISEASE_LIST_URL=https://api.myapp.com/disease-list

NODE_ENV=production
```
Create a .dockerignore file in the root directory:
```
node_modules
npm-debug.log
Dockerfile
.dockerignore
.git
```

### Create Dockerfile
Create a file named Dockerfile in your project root:

```
1. Use a lightweight Node.js base image
FROM node:20-alpine

2. Set working directory inside container
WORKDIR /app

3. Copy package files first (for caching)
COPY package*.json ./

# 4. Install only production dependencies
RUN npm install --production

5. Copy the rest of the app
COPY . .

6. Expose the port the app will run on
EXPOSE 3000

7. Default environment
ENV NODE_ENV=production

8. Start the app
CMD ["node", "server.js"]
```

### Build Docker Image
In your terminal (project root):
```
docker build -t express-web-app .
```
Check the image:
```
docker images
```

You should see express-web-app.

### Run the Container
## Option A: Using .env File
### Run container with .env:
```
docker run -d \
  -p 3000:3000 \
  --env-file .env \
  --name express-container \
  express-web-app
```
Explanation:
- -d → runs in background
- -p 3000:3000 → maps container port to host
- --env-file .env → loads all environment variables
- --name express-container → gives the container a name

Check Logs:
```
docker logs -f express-container
```

Then open in browser:
```
http://localhost:3000
```

## Option B: Passing Environment Variables Manually
```
docker run -d -p 3000:3000 --name express-container \
  -e CLOUDINARY_CLOUD_NAME=mycloud \
  -e CLOUDINARY_API_KEY=123456789 \
  -e CLOUDINARY_API_SECRET=abcdef123456 \
  -e DATABASE_URL=postgres://user:password@dbhost:5432/mydb \
  -e GROQ_API_URL=https://api.groq.com/v1/chat/completions \
  -e GROQ_API_KEY=your_groq_key \
  -e DISEASE_INFO_URL=https://plantvillage.com/onions \
  -e DISEASE_LIST_URL=https://api.myapp.com/disease-list \
  express-web-app
```

Check running containers:
```
docker ps
```
View logs:
```
docker logs -f express-container
```

Access app:
```
http://localhost:3000
```

## 5. Verify Environment Variables Inside Container
```
docker exec -it express-container sh
printenv | grep CLOUDINARY
printenv | grep DATABASE_URL
exit
```
## 6. Stop and Remove Container
```
docker stop express-container
docker rm express-container
```