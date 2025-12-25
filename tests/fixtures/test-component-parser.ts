/**
 * Test script to verify SWC-based component parser
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { parseComponents as parseComponentsRegex } from './src/commands/context/parsers/components';
import { parseComponents as parseComponentsSwc } from './src/commands/context/parsers/components-swc';

// Create test component
const testComponent = `'use client';

/**
 * Booking form component
 * @feature booking
 */

import { useForm } from 'react-hook-form';
import { Input, Select, DatePicker } from '@/components/ui';
import { useBookingMutation } from '@/hooks/booking';

export default function BookingForm() {
  const { register, handleSubmit, setError } = useForm();
  const mutation = useBookingMutation();

  const onSubmit = async (data) => {
    try {
      await mutation.mutate(data);
      toast.error('Failed to book');
    } catch (error) {
      setError('root', { message: error.message });
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Input {...register('name')} id="name" />
      <Select name="service" />
      <DatePicker name="date" />
    </form>
  );
}
`;

// Create temp directory
const tempDir = path.join(process.cwd(), '.test-components');
fs.mkdirSync(tempDir, { recursive: true });

// Write test file
const testFile = path.join(tempDir, 'BookingForm.tsx');
fs.writeFileSync(testFile, testComponent);

try {
  console.log('Testing component parsers...\n');

  // Test regex-based parser
  console.log('=== REGEX-BASED PARSER ===');
  const regexResults = parseComponentsRegex(tempDir, ['booking']);
  console.log(JSON.stringify(regexResults, null, 2));

  // Test SWC-based parser
  console.log('\n=== SWC-BASED PARSER ===');
  const swcResults = parseComponentsSwc(tempDir, ['booking']);
  console.log(JSON.stringify(swcResults, null, 2));

  // Compare results
  console.log('\n=== COMPARISON ===');
  if (regexResults.length !== swcResults.length) {
    console.log('❌ Different number of results');
  } else if (regexResults.length === 0) {
    console.log('⚠️  No results from either parser');
  } else {
    const regex = regexResults[0];
    const swc = swcResults[0];

    console.log('Name:', regex?.name === swc?.name ? '✅' : '❌', regex?.name, 'vs', swc?.name);
    console.log('Type:', regex?.type === swc?.type ? '✅' : '❌', regex?.type, 'vs', swc?.type);
    console.log(
      'Purpose:',
      regex?.purpose === swc?.purpose ? '✅' : '❌',
      regex?.purpose,
      'vs',
      swc?.purpose,
    );
    console.log(
      'State:',
      regex?.state === swc?.state ? '✅' : '❌',
      regex?.state,
      'vs',
      swc?.state,
    );
    console.log(
      'Features:',
      JSON.stringify(regex?.features) === JSON.stringify(swc?.features) ? '✅' : '❌',
      regex?.features,
      'vs',
      swc?.features,
    );
    console.log(
      'Hooks count:',
      regex?.hooks.length === swc?.hooks.length ? '✅' : '❌',
      regex?.hooks.length,
      'vs',
      swc?.hooks.length,
    );
    console.log(
      'Imports count:',
      regex?.imports.length === swc?.imports.length ? '✅' : '❌',
      regex?.imports.length,
      'vs',
      swc?.imports.length,
    );
    console.log(
      'Fields:',
      JSON.stringify(regex?.fields?.sort()) === JSON.stringify(swc?.fields?.sort()) ? '✅' : '❌',
      regex?.fields?.sort(),
      'vs',
      swc?.fields?.sort(),
    );
  }
} finally {
  // Cleanup
  fs.rmSync(tempDir, { recursive: true, force: true });
  console.log('\n✅ Cleanup complete');
}
