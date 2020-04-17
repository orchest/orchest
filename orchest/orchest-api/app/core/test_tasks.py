import json

from tasks import Pipeline


def main():
    uuids = {
        'Step 1': '6338e764-c862-4c83-adf3-43a8299b3e32',
        'Step 2': '1eb19c11-52c6-418f-80cf-96b4ca4ebb83'
    }
    with open('pipeline.json', 'r') as f:
        description = json.load(f)

    pipeline = Pipeline.from_json(description)

    print(pipeline.sentinel)

    print(pipeline.incoming(uuids['Step 1']))
    print(pipeline.incoming(uuids['Step 2']))


if __name__ == '__main__':
    main()
