import { getOffers, appendOffer, updateOffer, deleteOffer, normalizeOffer, requireAdmin } from "./_offers.js";

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const offers = await getOffers();
      const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
      const isAdmin = req.headers["x-admin"] === "true" && token === process.env.ADMIN_SESSION_SECRET;
      return res.status(200).json({
        success: true,
        offers: isAdmin ? offers : offers.filter(o => o.status === "Active")
      });
    }

    requireAdmin(req);

    if (req.method === "POST") {
      const offer = normalizeOffer(req.body);
      if (!offer.vertical || !offer.name) return res.status(400).json({ error: "Vertical and Offer Name are required" });
      return res.status(200).json({ success: true, offer: await appendOffer(offer) });
    }

    if (req.method === "PUT") {
      const offer = normalizeOffer(req.body);
      if (!offer.id) return res.status(400).json({ error: "Offer ID is required" });
      return res.status(200).json({ success: true, offer: await updateOffer(offer) });
    }

    if (req.method === "DELETE") {
      await deleteOffer(req.body?.id);
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    console.error(error);
    return res.status(error.status || 500).json({ error: error.message || "Server error" });
  }
}

