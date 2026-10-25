import { NextRequest, NextResponse } from "next/server";
import { defaultSettingsStore } from "../../../../core/infra/storage/settings_store.ts";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const key = searchParams.get("key");

    if (key) {
      const val = defaultSettingsStore.get(key);
      return NextResponse.json({ key, value: val });
    }

    const list = defaultSettingsStore.list();
    const dictionary: Record<string, any> = {};
    for (const item of list) {
      dictionary[item.key] = item.value;
    }

    return NextResponse.json({
      status: "success",
      settings: dictionary,
      items: list,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Support single key-value: { key: "...", value: ... }
    if (body.key && body.value !== undefined) {
      defaultSettingsStore.set(body.key, body.value);
      return NextResponse.json({ status: "updated", key: body.key, value: body.value });
    }

    // Support batch update: { "general.language": "en", ... }
    for (const [k, v] of Object.entries(body)) {
      if (k.startsWith("_")) continue;
      defaultSettingsStore.set(k, v);
    }

    return NextResponse.json({ status: "updated" });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 422 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const key = searchParams.get("key");

    if (key) {
      defaultSettingsStore.reset(key);
      return NextResponse.json({ status: "reset", key });
    }

    defaultSettingsStore.resetAll();
    return NextResponse.json({ status: "reset_all" });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
