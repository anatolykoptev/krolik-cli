// Test file for simplify rules

function getLabel(status: string): string {
  if (status === 'A') {
    return 'Alpha';
  } else if (status === 'B') {
    return 'Beta';
  } else if (status === 'C') {
    return 'Gamma';
  } else {
    return 'Unknown';
  }
}

function check(val: boolean): boolean {
  return val === true;
}

function test(data: unknown) {
  if (!data) {
    return null;
  } else {
    return (data as { value: string }).value;
  }
}

const name = 'test';
const age = 30;
const obj = { name: name, age: age };

const a = () => {};
const b = () => {};
const c = () => {};

const value = 1;
const isActive = !!value;
