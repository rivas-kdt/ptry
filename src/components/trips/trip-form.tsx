"use client";

import { Loader2 } from "lucide-react";
import { useActionState, useEffect, useState, type ReactNode } from "react";
import type { TripFormState } from "@/app/(app)/trips/actions";
import { DestinationPicker, type PickedDestination } from "@/components/trips/destination-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type TripFormAction = (state: TripFormState, formData: FormData) => Promise<TripFormState>;

export function TripForm({
  action,
  submitLabel,
  pendingLabel,
  defaults,
  suggestions,
  hiddenFields,
  children,
  onSaved,
}: {
  action: TripFormAction;
  submitLabel: string;
  pendingLabel: string;
  defaults?: {
    name?: string;
    destination?: PickedDestination | null;
    start_date?: string;
    end_date?: string;
  };
  suggestions?: PickedDestination[];
  hiddenFields?: Record<string, string>;
  /** Extra fields rendered above the submit button. */
  children?: ReactNode;
  onSaved?: () => void;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const [destination, setDestination] = useState(defaults?.destination ?? null);
  const [startDate, setStartDate] = useState(defaults?.start_date ?? "");
  const [endDate, setEndDate] = useState(defaults?.end_date ?? "");

  useEffect(() => {
    if (state.saved) onSaved?.();
  }, [state.saved, onSaved]);

  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      {Object.entries(hiddenFields ?? {}).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <input type="hidden" name="destination_id" value={destination?.id ?? ""} />
      <input type="hidden" name="destination_name" value={destination?.name ?? ""} />

      <div className="flex flex-col gap-2">
        <Label>Destination</Label>
        <DestinationPicker
          value={destination}
          onChange={setDestination}
          suggestions={suggestions}
          invalid={Boolean(errors.destination_id)}
          autoFocus={!defaults?.destination && !defaults?.name}
        />
        <FieldError message={errors.destination_id} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="trip-start">Start date</Label>
          <Input
            id="trip-start"
            name="start_date"
            type="date"
            required
            value={startDate}
            onChange={(event) => {
              setStartDate(event.target.value);
              if (!endDate || event.target.value > endDate) setEndDate(event.target.value);
            }}
            aria-invalid={Boolean(errors.start_date) || undefined}
            className="h-11"
          />
          <FieldError message={errors.start_date} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="trip-end">End date</Label>
          <Input
            id="trip-end"
            name="end_date"
            type="date"
            required
            min={startDate || undefined}
            value={endDate}
            onChange={(event) => setEndDate(event.target.value)}
            aria-invalid={Boolean(errors.end_date) || undefined}
            className="h-11"
          />
          <FieldError message={errors.end_date} />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="trip-name">Trip name</Label>
        <Input
          id="trip-name"
          name="name"
          maxLength={120}
          defaultValue={defaults?.name}
          placeholder={destination ? `Trip to ${destination.name}` : "e.g. Summer in Japan"}
          aria-invalid={Boolean(errors.name) || undefined}
          className="h-11"
        />
        <FieldError message={errors.name} />
      </div>

      {children}

      {state.error ? (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      ) : null}

      <Button type="submit" size="lg" disabled={pending} className="h-11">
        {pending ? <Loader2 className="animate-spin" /> : null}
        {pending ? pendingLabel : submitLabel}
      </Button>
    </form>
  );
}

function FieldError({ message }: { message?: string }) {
  return message ? <p className="text-xs text-destructive">{message}</p> : null;
}
