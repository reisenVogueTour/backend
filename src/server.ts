import dotenv from "dotenv";
import app from "./app";

dotenv.config();

const PORT = Number(process.env.PORT) || 5500;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
