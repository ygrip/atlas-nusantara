import type { CuisineDish } from './cuisine-contract';

export type CuisineSortKey = 'recipes' | 'name' | 'group';
export type CuisineSortDirection = 'ascending' | 'descending';
export type CuisineContentFilter = 'all' | 'recipe' | 'photo';

export interface CuisineFilterOptions {
  query?: string;
  group?: string;
  content?: CuisineContentFilter;
}

function normalize(value: string): string {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().trim();
}

export function recipeCount(dish: CuisineDish): number {
  return dish.recipes?.length ?? 0;
}

export function filterDishes(dishes: readonly CuisineDish[], options: CuisineFilterOptions): CuisineDish[] {
  const query = normalize(options.query ?? '');
  return dishes.filter(dish => {
    if (options.group && options.group !== 'all' && dish.group !== options.group) return false;
    if (options.content === 'recipe' && recipeCount(dish) === 0) return false;
    if (options.content === 'photo' && !dish.images) return false;
    if (!query) return true;
    const ingredients = (dish.recipes ?? []).flatMap(recipe => recipe.ingredients);
    return normalize([dish.name, dish.id, ...ingredients].join(' ')).includes(query);
  });
}

export function sortDishes(dishes: readonly CuisineDish[], key: CuisineSortKey, direction: CuisineSortDirection, locale: string): CuisineDish[] {
  let multiplier = 1;
  if (direction === 'descending') multiplier = -1;
  return dishes.map((dish, index) => ({ dish, index })).sort((left, right) => {
    let comparison = 0;
    // Most recipes first when ascending, so the best documented dishes lead the default view.
    if (key === 'recipes') comparison = recipeCount(right.dish) - recipeCount(left.dish);
    if (key === 'name') comparison = left.dish.name.localeCompare(right.dish.name, locale, { sensitivity: 'base' });
    if (key === 'group') comparison = left.dish.group.localeCompare(right.dish.group, 'en');
    if (comparison !== 0) return comparison * multiplier;
    return left.dish.name.localeCompare(right.dish.name, locale, { sensitivity: 'base' }) || left.index - right.index;
  }).map(item => item.dish);
}
