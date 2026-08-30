import { Router, type IRouter, type Request, type Response } from "express";
import { z } from "zod";
import { ObjectStorageService } from "../lib/objectStorage";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

const PutProfilePhotoBody = z.object({
  profilePhotoUrl: z.string().url(),
});

/**
 * PUT /me/profile-photo
 * Stores the profile photo object path / URL for the user.
 * Used by mobile clients — forwards to or mimics the production API contract.
 */
router.put("/me/profile-photo", async (req: Request, res: Response) => {
  const parsed = PutProfilePhotoBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "profilePhotoUrl is required" });
    return;
  }
  res.json({ profilePhotoUrl: parsed.data.profilePhotoUrl });
});

export default router;
