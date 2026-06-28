import cors from "cors";
import express from "express";
import { setupSwagger } from "./docs/swagger/setup";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import routes from "./routes";

const app = express();

app.use(cors());
app.use(express.json());

setupSwagger(app);

app.get("/", (_req, res) => {
  res.json({
    message: " Connect API is running",
    docs: "/api-docs",
  });
});

app.get("/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    service: "get-your-tour-api",
  });
});

app.use("/api", routes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
