export async function onRequest(context) {
  const url = new URL(context.request.url);

  const id = url.searchParams.get("id");
  const token = url.searchParams.get("token");

  if (!id || !token) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Call your Google Script
  const res = await fetch("https://script.google.com/macros/s/AKfycbyl0_Aq4jBLmMKTqXORLxb6AGJ0xKOYti-DITn6Ix0NbnSSgPDKRSxQKAZ24sz_0DTG/exec", {
    method: "POST",
    body: JSON.stringify({ action: "getStaff" })
  });

  const staff = await res.json();

  const user = staff.find(s => s.discordId == id);

  if (!user || user.secretToken !== token || user.isActive !== true) {
    return new Response("Access Denied", { status: 403 });
  }

  // Pass user info forward
  context.data.user = user;

  return context.next();
}